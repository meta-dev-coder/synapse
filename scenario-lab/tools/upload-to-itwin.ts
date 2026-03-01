/**
 * upload-to-itwin.ts
 *
 * Creates an iTwin iModel from laneGeometry.json and uploads it to the
 * Bentley iTwin Platform so it can be viewed in the iTwin iViewer.
 *
 * Usage:
 *   1. Register a Native/Mobile app at https://developer.bentley.com/my-apps
 *      (set redirect URI to http://localhost:3000/signin-callback, scope: itwin-platform)
 *   2. Copy .env.example to .env and set CLIENT_ID to that app's client_id
 *   3. npm install
 *   4. npm run upload  — a browser login prompt will appear
 *
 * Output: A viewer URL printed to console when the upload succeeds.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import axios from 'axios';

import {
  IModelHost,
  SnapshotDb,
  SpatialCategory,
  PhysicalModel,
} from '@itwin/core-backend';

import {
  Point3d,
  LineString3d,
  YawPitchRollAngles,
  Range3d,
} from '@itwin/core-geometry';

import {
  ColorDef,
  Code,
  IModel,
  Cartographic,
  GeometricElement3dProps,
  SubCategoryAppearance,
  GeometryStreamBuilder,
  EcefLocation,
} from '@itwin/core-common';

dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────

const CLIENT_ID   = process.env.CLIENT_ID!;
const ITWIN_ID    = process.env.ITWIN_ID    || '1396411a-1d56-4cec-94cf-3b92a5daac68';
const IMODEL_NAME = process.env.IMODEL_NAME || 'Scenario Lab — Corridor Model';

const GEOJSON_PATH  = path.resolve(__dirname, '../frontend/src/data/laneGeometry.json');
const OUTPUT_BIM    = path.resolve(__dirname, './output/corridor-model.bim');

const IMS_TOKEN_URL = 'https://ims.bentley.com/connect/token';
const IMODELS_API   = 'https://api.bentley.com/imodels';

// Corridor geographic anchor (plaza center)
const ANCHOR_LON = 4.8950;
const ANCHOR_LAT = 52.3750;
const ANCHOR_ALT = 12.0;

// At 52.375°N: 1° lat ≈ 111,320m, 1° lon ≈ 67,700m
const DEG_TO_M_LAT = 111320;
const DEG_TO_M_LON = 67700;

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeoJsonFeature {
  type: 'Feature';
  id: string;
  properties: Record<string, any>;
  geometry: {
    type: 'LineString' | 'Polygon' | 'Point';
    coordinates: number[][] | number[][][] | number[];
  };
}

interface GeoJsonCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

// ─── Step 1: OAuth token (Authorization Code + PKCE) ─────────────────────────

const REDIRECT_URI = 'http://localhost:3000/signin-callback';
const AUTH_URL     = 'https://ims.bentley.com/connect/authorize';

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier  = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

async function getAccessToken(): Promise<string> {
  if (!CLIENT_ID) {
    throw new Error(
      'Missing CLIENT_ID in .env\n' +
      'Register a Native/Mobile app at: https://developer.bentley.com/my-apps\n' +
      'Redirect URI: http://localhost:3000/signin-callback  |  Scope: itwin-platform'
    );
  }

  const { verifier, challenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = new URL(AUTH_URL);
  authUrl.searchParams.set('client_id',             CLIENT_ID);
  authUrl.searchParams.set('response_type',          'code');
  authUrl.searchParams.set('redirect_uri',           REDIRECT_URI);
  authUrl.searchParams.set('scope',                  'itwin-platform');
  authUrl.searchParams.set('state',                  state);
  authUrl.searchParams.set('code_challenge',         challenge);
  authUrl.searchParams.set('code_challenge_method',  'S256');

  console.log('\n🌐 Opening browser for Bentley sign-in...');
  console.log(`   (If it doesn't open automatically, visit:\n   ${authUrl.toString()})\n`);

  // Open the system browser (macOS)
  exec(`open "${authUrl.toString()}"`);

  // Spin up a temporary local server to catch the redirect
  return new Promise((resolve, reject) => {
    let handled = false;

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, 'http://localhost:3000');

      // Ignore everything that isn't the callback path
      if (url.pathname !== '/signin-callback') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Only handle the callback once
      if (handled) { res.writeHead(204); res.end(); return; }
      handled = true;

      try {
        const code          = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const errorParam    = url.searchParams.get('error');

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body style="font-family:sans-serif;padding:40px">'
          + '<h2>✅ Login successful — you can close this tab.</h2>'
          + '</body></html>');
        server.close();

        if (errorParam) {
          return reject(new Error(`IMS returned error: ${errorParam} — ${url.searchParams.get('error_description') ?? ''}`));
        }
        if (returnedState !== state) {
          return reject(new Error(`State mismatch (expected ${state}, got ${returnedState})`));
        }
        if (!code) {
          return reject(new Error('No authorization code in callback'));
        }

        // Exchange code for access token
        const tokenRes = await axios.post(
          IMS_TOKEN_URL,
          new URLSearchParams({
            grant_type:    'authorization_code',
            client_id:     CLIENT_ID,
            code,
            redirect_uri:  REDIRECT_URI,
            code_verifier: verifier,
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        console.log('✅ Authentication successful');
        resolve(tokenRes.data.access_token as string);
      } catch (err) {
        reject(err);
      }
    });

    server.listen(3000, '127.0.0.1', () => {
      console.log('⏳ Waiting for browser login (listening on localhost:3000)...\n');
    });

    server.on('error', reject);

    // Timeout after 3 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Login timed out after 3 minutes — please run again.'));
    }, 3 * 60 * 1000);
  });
}

// ─── Step 2: Create iModel + initiate baseline upload (two separate calls) ───

async function createIModel(token: string, fileSizeBytes: number): Promise<{
  iModelId: string;
  uploadUrl: string;
  completeUrl: string;
}> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.bentley.itwin-platform.v2+json',
  };

  // ── 2a: Delete any existing iModel with the same name (idempotent) ─────────
  console.log(`\n📦 Checking for existing iModel "${IMODEL_NAME}"...`);

  const listRes = await axios.get(
    `${IMODELS_API}?iTwinId=${ITWIN_ID}&name=${encodeURIComponent(IMODEL_NAME)}`,
    { headers }
  );

  const existing = listRes.data.iModels?.[0];
  if (existing) {
    console.log(`🗑️  Found existing iModel (ID: ${existing.id}) — deleting...`);
    await axios.delete(`${IMODELS_API}/${existing.id}`, { headers });
    console.log('✅ Deleted');
  }

  // ── 2b: Create iModel with fromBaseline mode (single call) ──────────────
  console.log(`📦 Creating iModel "${IMODEL_NAME}" in project ${ITWIN_ID}...`);

  const createRes = await axios.post(
    IMODELS_API,
    {
      iTwinId:      ITWIN_ID,
      name:         IMODEL_NAME,
      description:  'A10-West Toll Plaza corridor — 4 lane geometry for Scenario Lab POC',
      extent: {
        southWest: { latitude: 52.362, longitude: 4.8944 },
        northEast: { latitude: 52.388, longitude: 4.8958 },
      },
      creationMode: 'fromBaseline',
      baselineFile: { size: fileSizeBytes },
    },
    { headers }
  );

  const iModelId:   string = createRes.data.iModel.id;
  const uploadUrl:  string = createRes.data.iModel._links.upload.href;
  const completeUrl: string = createRes.data.iModel._links.complete.href;

  console.log(`✅ iModel created — ID: ${iModelId}`);
  return { iModelId, uploadUrl, completeUrl };
}

// ─── Step 3: Build local Snapshot iModel from GeoJSON ────────────────────────

function wgs84ToLocal(lon: number, lat: number, alt: number): Point3d {
  // Convert WGS84 degrees to local metre offsets relative to anchor
  const x = (lon - ANCHOR_LON) * DEG_TO_M_LON;
  const y = (lat - ANCHOR_LAT) * DEG_TO_M_LAT;
  const z = alt - ANCHOR_ALT;
  return Point3d.create(x, y, z);
}

async function buildSnapshotIModel(geoJson: GeoJsonCollection): Promise<string> {
  console.log('\n🏗️  Building local Snapshot iModel...');

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_BIM);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Remove stale output file if present
  if (fs.existsSync(OUTPUT_BIM)) fs.unlinkSync(OUTPUT_BIM);

  await IModelHost.startup();

  const iModel = SnapshotDb.createEmpty(OUTPUT_BIM, {
    rootSubject: { name: IMODEL_NAME },
  });

  // ── Georeference: set ECEF location so iViewer shows correct map position ──
  const cartographic = Cartographic.fromDegrees({
    longitude: ANCHOR_LON,
    latitude:  ANCHOR_LAT,
    height:    ANCHOR_ALT,
  });
  const ecefLocation = EcefLocation.createFromCartographicOrigin(cartographic);
  iModel.setEcefLocation(ecefLocation);

  // Extend project extents to cover the full corridor
  iModel.updateProjectExtents(Range3d.createXYZXYZ(-500, -1500, -20, 500, 1500, 50));

  // ── Create SpatialCategory per lane type ──────────────────────────────────

  const LANE_COLORS: Record<string, ColorDef> = {
    HOV_EXPRESS: ColorDef.create(0x4A90E2),   // blue
    ETC:         ColorDef.create(0x7ED321),   // green
    CASH:        ColorDef.create(0xE85D4A),   // red
    DEFAULT:     ColorDef.create(0xAAAAAA),   // grey for boundaries
  };

  const categoryIds: Record<string, string> = {};

  for (const [typeName, color] of Object.entries(LANE_COLORS)) {
    const categoryId = SpatialCategory.insert(
      iModel,
      IModel.dictionaryId,
      `Toll ${typeName}`,
      new SubCategoryAppearance({ color: color.tbgr, weight: 4 })
    );
    categoryIds[typeName] = categoryId;
  }

  // ── Create Physical Model ─────────────────────────────────────────────────

  const modelId = PhysicalModel.insert(
    iModel,
    IModel.rootSubjectId,
    'Corridor Model'
  );

  // ── Insert elements from GeoJSON features ─────────────────────────────────

  let insertedCount = 0;

  for (const feature of geoJson.features) {
    const geomType   = feature.geometry.type;
    const props      = feature.properties;
    const laneType   = props.lane_type as string | undefined;
    const featureType = props.type as string | undefined;

    // Pick category
    let categoryId = categoryIds['DEFAULT'];
    if (laneType && categoryIds[laneType]) {
      categoryId = categoryIds[laneType];
    }

    // Label for the element
    const userLabel = props.lane_label ?? props.name ?? feature.id;

    const builder = new GeometryStreamBuilder();

    if (geomType === 'LineString') {
      const coords = feature.geometry.coordinates as number[][];
      const pts    = coords.map(([lon, lat, alt = 12]) => wgs84ToLocal(lon, lat, alt));

      if (pts.length >= 2) {
        const line = LineString3d.createPoints(pts);
        builder.appendGeometry(line);
      }
    } else if (geomType === 'Polygon') {
      const rings  = feature.geometry.coordinates as number[][][];
      const outer  = rings[0];
      const pts    = outer.map(([lon, lat, alt = 12]) => wgs84ToLocal(lon, lat, alt));

      if (pts.length >= 3) {
        // Close the loop if not already closed
        const closedPts = pts[0].isAlmostEqual(pts[pts.length - 1]) ? pts : [...pts, pts[0]];
        const line      = LineString3d.createPoints(closedPts);
        builder.appendGeometry(line);
      }
    } else if (geomType === 'Point') {
      const [lon, lat, alt = 12] = feature.geometry.coordinates as number[];
      const pt = wgs84ToLocal(lon, lat, alt);
      // Render points as a small cross (two short line segments)
      const d = 5; // 5m cross arm
      builder.appendGeometry(LineString3d.createPoints([
        Point3d.create(pt.x - d, pt.y, pt.z),
        Point3d.create(pt.x + d, pt.y, pt.z),
      ]));
      builder.appendGeometry(LineString3d.createPoints([
        Point3d.create(pt.x, pt.y - d, pt.z),
        Point3d.create(pt.x, pt.y + d, pt.z),
      ]));
    } else {
      continue; // skip unknown geometry types
    }

    // Use first coordinate as placement origin
    let placementOrigin = Point3d.createZero();
    if (geomType === 'LineString') {
      const coords = feature.geometry.coordinates as number[][];
      const [lon, lat, alt = 12] = coords[0];
      placementOrigin = wgs84ToLocal(lon, lat, alt);
    } else if (geomType === 'Polygon') {
      const rings  = feature.geometry.coordinates as number[][][];
      const [lon, lat, alt = 12] = rings[0][0];
      placementOrigin = wgs84ToLocal(lon, lat, alt);
    } else if (geomType === 'Point') {
      const [lon, lat, alt = 12] = feature.geometry.coordinates as number[];
      placementOrigin = wgs84ToLocal(lon, lat, alt);
    }

    const elementProps: GeometricElement3dProps = {
      classFullName: 'Generic:PhysicalObject',
      model:         modelId,
      category:      categoryId,
      code:          Code.createEmpty(),
      userLabel,
      geom:          builder.geometryStream,
      placement: {
        origin: placementOrigin,
        angles: new YawPitchRollAngles(),
      },
    };

    iModel.elements.insertElement(elementProps as any);
    insertedCount++;
  }

  iModel.saveChanges('Initial corridor geometry import');
  iModel.close();

  await IModelHost.shutdown();

  const sizeBytes = fs.statSync(OUTPUT_BIM).size;
  console.log(`✅ Snapshot iModel built — ${insertedCount} elements, ${(sizeBytes / 1024).toFixed(1)} KB`);

  return OUTPUT_BIM;
}

// ─── Step 4: Upload .bim to iTwin cloud ──────────────────────────────────────

async function uploadBaseline(
  token: string,
  uploadUrl: string,
  completeUrl: string,
  bimPath: string
): Promise<void> {
  console.log('\n⬆️  Uploading .bim file to Bentley cloud storage...');

  const fileBuffer    = fs.readFileSync(bimPath);
  const fileSizeBytes = fileBuffer.length;

  // Upload binary to Azure Blob Storage via the pre-signed URL
  await axios.put(uploadUrl, fileBuffer, {
    headers: {
      'Content-Type':   'application/octet-stream',
      'Content-Length': fileSizeBytes,
      'x-ms-blob-type': 'BlockBlob',
    },
    maxBodyLength:    Infinity,
    maxContentLength: Infinity,
  });

  console.log('✅ File uploaded to cloud storage');

  // Signal completion using the exact URL returned by the API
  await axios.post(
    completeUrl,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.bentley.itwin-platform.v2+json',
      },
    }
  );

  console.log('✅ Baseline upload confirmed');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log(' Scenario Lab — iTwin iModel Upload Tool   ');
  console.log('═══════════════════════════════════════════\n');

  // Load GeoJSON
  if (!fs.existsSync(GEOJSON_PATH)) {
    throw new Error(`laneGeometry.json not found at: ${GEOJSON_PATH}`);
  }
  const geoJson: GeoJsonCollection = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf-8'));
  console.log(`📂 Loaded ${geoJson.features.length} features from laneGeometry.json`);

  // Build local Snapshot first so we know the file size for the API call
  const bimPath = await buildSnapshotIModel(geoJson);
  const fileSizeBytes = fs.statSync(bimPath).size;

  // Authenticate
  const token = await getAccessToken();

  // Create iModel in the cloud (with correct file size)
  const { iModelId, uploadUrl, completeUrl } = await createIModel(token, fileSizeBytes);

  // Upload the .bim file and signal completion
  await uploadBaseline(token, uploadUrl, completeUrl, bimPath);

  // ── Done ──────────────────────────────────────────────────────────────────
  const viewerUrl = `https://viewer.itwin.dev/?iTwinId=${ITWIN_ID}&iModelId=${iModelId}`;

  console.log('\n═══════════════════════════════════════════');
  console.log('✅ SUCCESS — iModel is live on Bentley iTwin');
  console.log('═══════════════════════════════════════════');
  console.log(`\n  iTwin ID  : ${ITWIN_ID}`);
  console.log(`  iModel ID : ${iModelId}`);
  console.log(`\n  Open in iViewer:`);
  console.log(`  ${viewerUrl}`);
  console.log('');
}

main().catch((err) => {
  console.error('\n❌ Upload failed:', err.response?.data ?? err.message);
  process.exit(1);
});
