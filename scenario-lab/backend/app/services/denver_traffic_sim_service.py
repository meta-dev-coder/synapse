"""
Denver Traffic Simulation service.

Ports region-based vehicle traffic simulation from the Streamlit prototype
(app4.py) into a stateless FastAPI-compatible module.
"""
from __future__ import annotations

import functools
import logging
import pickle
import threading
from collections import Counter
from pathlib import Path
from uuid import uuid4

import geopandas as gpd
import networkx as nx
import numpy as np
import osmnx as ox
from shapely.geometry import Polygon

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_VEHICLE_DENSITY = 60  # vehicles per km²
MAX_VEHICLES = 500

MODE_SPLIT = {"car": 0.75, "truck": 0.10, "van": 0.08, "bus": 0.05, "bike": 0.02}
MODE_SPEED = {"car": 0.004, "truck": 0.0025, "van": 0.003, "bus": 0.0025, "bike": 0.0015}

GEOJSON_PATH = (
    Path(__file__).parent.parent.parent
    / "datasets"
    / "ODC_ADMN_NEIGHBORHOOD_A_1602360660284787754.geojson"
)

# ---------------------------------------------------------------------------
# OSMnx caching
# ---------------------------------------------------------------------------

ox.settings.use_cache = True
ox.settings.cache_folder = str(Path(__file__).parent.parent.parent / ".osmnx_cache")

# ---------------------------------------------------------------------------
# Graph pickle cache directory
# ---------------------------------------------------------------------------

_GRAPH_CACHE_DIR = Path(__file__).parent.parent.parent / ".graph_cache"

# ---------------------------------------------------------------------------
# Module-level caches
# ---------------------------------------------------------------------------

_neighborhoods_cache: list[dict] | None = None
_gdf_cache: gpd.GeoDataFrame | None = None


def _load_gdf() -> gpd.GeoDataFrame:
    """Load and cache the neighborhood GeoDataFrame."""
    global _gdf_cache
    if _gdf_cache is None:
        _gdf_cache = gpd.read_file(str(GEOJSON_PATH))
    return _gdf_cache


# ---------------------------------------------------------------------------
# Public: get_neighborhoods
# ---------------------------------------------------------------------------


def get_neighborhoods() -> list[dict]:
    """Return list of Denver neighborhoods with id, name, typology, area_km2."""
    global _neighborhoods_cache
    if _neighborhoods_cache is not None:
        return _neighborhoods_cache

    gdf = _load_gdf().copy()

    # Compute area in metric projection
    gdf_m = gdf.to_crs(epsg=3857)
    gdf["area_km2"] = gdf_m.geometry.area / 1e6

    results = []
    for _, row in gdf.iterrows():
        typology = row.get("TYPOLOGY")
        results.append(
            {
                "id": str(row["NBHD_ID"]),
                "name": row["NBHD_NAME"],
                "typology": typology if isinstance(typology, str) else None,
                "area_km2": round(row["area_km2"], 4),
            }
        )

    _neighborhoods_cache = results
    return results


# ---------------------------------------------------------------------------
# Internal: polygon lookup
# ---------------------------------------------------------------------------

_polygon_cache: dict[str, tuple[Polygon, float]] = {}


def _get_neighborhood_polygon(neighborhood_id: str) -> tuple[Polygon, float]:
    """Return (polygon_4326, area_km2) for a given neighborhood."""
    if neighborhood_id in _polygon_cache:
        return _polygon_cache[neighborhood_id]

    gdf = _load_gdf()
    match = gdf[gdf["NBHD_ID"].astype(str) == neighborhood_id]
    if match.empty:
        raise ValueError(f"Neighborhood {neighborhood_id} not found")

    polygon = match.geometry.iloc[0]
    area_m = match.to_crs(epsg=3857).geometry.area.iloc[0]
    area_km2 = area_m / 1e6

    _polygon_cache[neighborhood_id] = (polygon, area_km2)
    return polygon, area_km2


# ---------------------------------------------------------------------------
# Internal: road graph (with pickle persistence)
# ---------------------------------------------------------------------------

_graph_cache: dict[str, nx.Graph] = {}


def _get_road_graph(polygon: Polygon, cache_key: str) -> nx.Graph:
    """Fetch road graph for the polygon via OSMnx (cached in-memory + pickle)."""
    if cache_key in _graph_cache:
        return _graph_cache[cache_key]

    # Try loading from pickle on disk
    pickle_path = _GRAPH_CACHE_DIR / f"{cache_key}.pkl"
    if pickle_path.exists():
        try:
            with open(pickle_path, "rb") as f:
                G = pickle.load(f)
            _graph_cache[cache_key] = G
            logger.info("Loaded graph from pickle: %s", cache_key)
            return G
        except Exception:
            logger.warning("Failed to load pickle for %s, re-fetching", cache_key)

    # Fetch from Overpass API
    try:
        G = ox.graph_from_polygon(polygon, network_type="drive")
    except Exception:
        logger.exception("Failed to fetch road graph for %s", cache_key)
        G = nx.Graph()

    _graph_cache[cache_key] = G

    # Persist to disk for next startup
    try:
        _GRAPH_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with open(pickle_path, "wb") as f:
            pickle.dump(G, f)
        logger.info("Saved graph pickle: %s", cache_key)
    except Exception:
        logger.warning("Failed to save pickle for %s", cache_key)

    return G


# ---------------------------------------------------------------------------
# Internal: vehicle path generation
# ---------------------------------------------------------------------------


def _generate_vehicle_paths(G: nx.Graph, num_vehicles: int) -> list[dict]:
    """Generate random shortest-path routes on the graph."""
    if len(G.nodes) < 2:
        return []

    nodes = list(G.nodes)
    modes = list(MODE_SPLIT.keys())
    mode_probs = list(MODE_SPLIT.values())

    vehicles = []
    for _ in range(num_vehicles):
        path = None
        for _retry in range(3):
            start = np.random.choice(nodes)
            end = np.random.choice(nodes)
            if start == end:
                continue
            try:
                p = nx.shortest_path(G, start, end, weight="length")
                if len(p) >= 2:
                    path = p
                    break
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                continue

        if path is None:
            continue

        coords = [[G.nodes[n]["x"], G.nodes[n]["y"]] for n in path]
        mode = np.random.choice(modes, p=mode_probs)

        vehicles.append(
            {
                "id": str(uuid4()),
                "mode": str(mode),
                "path": coords,
                "speed": MODE_SPEED[str(mode)],
            }
        )

    return vehicles


# ---------------------------------------------------------------------------
# Public: init_simulation
# ---------------------------------------------------------------------------


def init_simulation(neighborhood_id: str, density: int = DEFAULT_VEHICLE_DENSITY) -> dict:
    """Initialise a traffic simulation for a given neighborhood."""
    polygon, area_km2 = _get_neighborhood_polygon(neighborhood_id)
    G = _get_road_graph(polygon, neighborhood_id)

    vehicle_count = min(int(area_km2 * density), MAX_VEHICLES)
    vehicles = _generate_vehicle_paths(G, vehicle_count)

    boundary = [[c[0], c[1]] for c in polygon.exterior.coords]

    mode_counts = Counter(v["mode"] for v in vehicles)

    return {
        "boundary": boundary,
        "vehicles": vehicles,
        "stats": {
            "vehicle_count": len(vehicles),
            "area_km2": round(area_km2, 4),
            "modes": dict(mode_counts),
        },
    }


# ---------------------------------------------------------------------------
# Public: repath_vehicles
# ---------------------------------------------------------------------------


def repath_vehicles(neighborhood_id: str, count: int) -> list[dict]:
    """Generate new vehicle paths for an existing simulation."""
    polygon, _ = _get_neighborhood_polygon(neighborhood_id)
    G = _get_road_graph(polygon, neighborhood_id)
    return _generate_vehicle_paths(G, count)


# ---------------------------------------------------------------------------
# City-wide simulation with pre-generated path pool
# ---------------------------------------------------------------------------

# Denver downtown core bounding box (compact area for fast OSMnx fetch)
_DENVER_CORE_BBOX = (-105.01, 39.725, -104.97, 39.755)  # west, south, east, north
_CITY_VEHICLE_COUNT = 200

# Pre-generated path pool
_path_pool: list[dict] = []
_pool_lock = threading.Lock()
_POOL_TARGET = 500
_POOL_LOW_WATERMARK = 100


def _refill_pool(G: nx.Graph, target: int = _POOL_TARGET) -> None:
    """Generate paths to refill the pool."""
    new_paths = _generate_vehicle_paths(G, target)
    with _pool_lock:
        _path_pool.extend(new_paths)
    logger.info("Pool refilled: %d paths now available", len(_path_pool))


def _ensure_city_graph() -> nx.Graph:
    """Ensure the city-wide road graph is loaded and return it."""
    cache_key = "__denver_core__"
    if cache_key not in _graph_cache:
        west, south, east, north = _DENVER_CORE_BBOX
        polygon = Polygon([
            (west, south), (east, south), (east, north), (west, north), (west, south)
        ])
        _get_road_graph(polygon, cache_key)
    return _graph_cache[cache_key]


def warm_city_cache() -> None:
    """Pre-load graph and generate path pool. Called from startup lifespan."""
    try:
        G = _ensure_city_graph()
        _refill_pool(G, _POOL_TARGET)
        logger.info("City cache warmed: %d paths in pool", len(_path_pool))
    except Exception:
        logger.exception("Failed to warm city cache")


def init_city_simulation() -> dict:
    """Initialise a city-wide traffic simulation for the Denver Pulse dashboard."""
    G = _ensure_city_graph()

    # Draw from pool if available, otherwise generate on-demand
    with _pool_lock:
        if len(_path_pool) >= _CITY_VEHICLE_COUNT:
            vehicles = _path_pool[:_CITY_VEHICLE_COUNT]
            del _path_pool[:_CITY_VEHICLE_COUNT]
        else:
            vehicles = list(_path_pool)
            _path_pool.clear()

    # If pool didn't have enough, generate the rest
    shortfall = _CITY_VEHICLE_COUNT - len(vehicles)
    if shortfall > 0:
        vehicles.extend(_generate_vehicle_paths(G, shortfall))

    # Trigger background refill if pool is low
    if len(_path_pool) < _POOL_LOW_WATERMARK:
        threading.Thread(target=_refill_pool, args=(G,), daemon=True).start()

    west, south, east, north = _DENVER_CORE_BBOX
    boundary = [
        [west, south], [east, south], [east, north], [west, north], [west, south]
    ]

    mode_counts = Counter(v["mode"] for v in vehicles)
    return {
        "boundary": boundary,
        "vehicles": vehicles,
        "stats": {
            "vehicle_count": len(vehicles),
            "area_km2": round(
                (east - west) * 111.32 * (north - south) * 111.32 * 0.85, 2
            ),
            "modes": dict(mode_counts),
        },
    }


def repath_city_vehicles(count: int) -> list[dict]:
    """Generate new vehicle paths for the city-wide simulation."""
    G = _ensure_city_graph()

    # Draw from pool
    with _pool_lock:
        if len(_path_pool) >= count:
            vehicles = _path_pool[:count]
            del _path_pool[:count]
        else:
            vehicles = list(_path_pool)
            _path_pool.clear()

    shortfall = count - len(vehicles)
    if shortfall > 0:
        vehicles.extend(_generate_vehicle_paths(G, shortfall))

    # Trigger background refill if pool is low
    if len(_path_pool) < _POOL_LOW_WATERMARK:
        threading.Thread(target=_refill_pool, args=(G,), daemon=True).start()

    return vehicles
