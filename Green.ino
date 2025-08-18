#include <DHT.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

// ----- WiFi Credentials -----
#define WIFI_SSID "Fred"
#define WIFI_PASSWORD "HelloWorld"

// ----- Firebase Configuration -----
#define API_KEY "AIzaSyAlNUrYfD37CqtrwTaXxBc0mLcgsLN1Poc"
#define DATABASE_URL "https://agrimind-a79c9-default-rtdb.firebaseio.com/"

// ----- Pin Definitions -----
#define DHTPIN 27
#define DHTTYPE DHT11
#define SOIL_PIN 32
#define BULB_RELAY_PIN 4
#define PUMP_RELAY_PIN 14

// ----- Sensor Setup -----
DHT dht(DHTPIN, DHTTYPE);

// ====== NEW: Soil calibration & control settings ======
struct SoilCalib {
  int dryRaw  = 3200; // default guess: very dry soil/air (ESP32 0..4095)
  int wetRaw  = 1200; // default guess: fully wet soil
} soilCal;

int legacyMoistureThresholdRaw = 2000;   // Kept for backward compatibility
int moistureLowPct  = 35;                // Pump ON at/under this %
int moistureHighPct = 45;                // Pump OFF at/over  this %
bool usePctControl  = true;              // prefer percentage control (recommended)

// ====== NEW: Sampling/filtering parameters ======
const int SOIL_SAMPLES = 32;             // per readSensors()
const int PROBE_RAIL_HIGH = 4090;        // near-rail detection
const int PROBE_RAIL_LOW  = 5;
const int PROBE_MARGIN    = 30;          // tolerance for rail checks
const int OUT_OF_RANGE_MARGIN = 100;     // tolerance outside [wetRaw, dryRaw]
float soilEMA = -1.0f;                   // optional smoothing
const float EMA_ALPHA = 0.20f;

// ----- Firebase Objects -----
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Timing
unsigned long sendDataPrevMillis = 0;
unsigned long sensorInterval = 2000;
unsigned long firebaseInterval = 5000;
unsigned long lastFirebaseUpdate = 0;
unsigned long lastRemoteCheckTime = 0;
unsigned long remoteCheckInterval = 3000;

// Firebase connection status
bool firebaseConnected = false;

// Global sensor values
float currentTemperature = 0.0;
float currentHumidity = 0.0;
int   currentSoilMoistureRaw = 0;     // raw ADC (0..4095)
int   currentSoilMoisturePct = 0;     // calibrated %
bool  soilPresent = true;
bool  soilFault   = false;

bool currentPumpStatus = false;
bool currentBulbStatus = true;

// Remote control
bool remotePumpControl = false;
bool remoteBulbControl = false;
bool remoteControlEnabled = true;

// Hysteresis state (percent-based)
bool pumpLatchedOn = false;

// Forward decls
void connectToWiFi();
void initializeFirebase();
void initializeFirebaseData();
void readSensors();
void updateFirebase();
void checkRemoteCommands();
int  medianOf(int *arr, int n);
int  readSoilRawMedian();
int  pctFromRaw(int raw);
void applyPumpLogic();
void maybeConvertLegacyRawThreshold();

void setup() {
  Serial.begin(115200);
  delay(800);

  Serial.println("=== ESP32 SMART FARMING SYSTEM (Calibrated Soil) ===");

  dht.begin();

  pinMode(BULB_RELAY_PIN, OUTPUT);
  pinMode(PUMP_RELAY_PIN, OUTPUT);
  digitalWrite(BULB_RELAY_PIN, LOW);   // ON (active LOW)
  digitalWrite(PUMP_RELAY_PIN, HIGH);  // OFF (active LOW)
  currentBulbStatus = true;
  currentPumpStatus = false;

  // Improve ADC dynamic range on ESP32
  analogSetPinAttenuation(SOIL_PIN, ADC_11db); // ~0-3.6V nominal range

  connectToWiFi();
  initializeFirebase();

  Serial.println("=== Setup Complete ===");
  Serial.println("Firebase Status: " + String(firebaseConnected ? "✅ READY" : "❌ FAILED"));
}

// ---------------- WiFi ----------------
void connectToWiFi() {
  Serial.println("📶 Connecting to WiFi...");
  Serial.println("SSID: " + String(WIFI_SSID));

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 30) {
    delay(1000);
    Serial.print(".");
    wifiAttempts++;
    if (wifiAttempts % 10 == 0) {
      Serial.println("\nStill trying to connect... (" + String(wifiAttempts) + "/30)");
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected");
    Serial.print("📡 IP: "); Serial.println(WiFi.localIP());
    Serial.print("📶 RSSI: "); Serial.println(WiFi.RSSI());
  } else {
    Serial.println("\n❌ WiFi connection failed. Retrying indefinitely...");
    while (1) {
      delay(5000);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      delay(10000);
    }
  }
}

// ---------------- Firebase ----------------
void initializeFirebase() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ Cannot initialize Firebase - WiFi not connected");
    return;
  }

  Serial.println("🔥 Initializing Firebase...");
  Serial.println("API Key: " + String(API_KEY));
  Serial.println("DB URL: " + String(DATABASE_URL));

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;
  config.max_token_generation_retry = 5;

  Serial.println("🔐 Anonymous authentication...");
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("✅ Anonymous signup successful");
  } else {
    Serial.print("⚠️ Signup failed: ");
    Serial.println(config.signer.signupError.message.c_str());
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.print("⏳ Waiting for Firebase");
  int attempts = 0;
  while (!Firebase.ready() && attempts < 30) {
    delay(1000);
    Serial.print(".");
    attempts++;
    if (attempts % 5 == 0) Serial.println();
  }

  if (!Firebase.ready()) {
    Serial.println("\n❌ Firebase not ready. Running locally.");
    firebaseConnected = false;
    return;
  }

  Serial.println("\n✅ Firebase ready");
  firebaseConnected = true;

  // Test write
  if (Firebase.RTDB.setString(&fbdo, "/system/status", "ESP32 Online - " + String(millis()))) {
    Serial.println("✅ Test write OK");
  } else {
    Serial.print("⚠️ Test write failed: ");
    Serial.println(fbdo.errorReason().c_str());
  }

  // Pull calibration & control settings (with defaults if missing)
  if (Firebase.RTDB.getInt(&fbdo, "/settings/soilCalibration/dryRaw") && fbdo.dataType() == "int") {
    soilCal.dryRaw = fbdo.intData();
  }
  if (Firebase.RTDB.getInt(&fbdo, "/settings/soilCalibration/wetRaw") && fbdo.dataType() == "int") {
    soilCal.wetRaw = fbdo.intData();
  }
  if (Firebase.RTDB.getInt(&fbdo, "/settings/moistureLowPct") && fbdo.dataType() == "int") {
    moistureLowPct = constrain(fbdo.intData(), 0, 100);
  }
  if (Firebase.RTDB.getInt(&fbdo, "/settings/moistureHighPct") && fbdo.dataType() == "int") {
    moistureHighPct = constrain(fbdo.intData(), 0, 100);
  }
  if (Firebase.RTDB.getBool(&fbdo, "/settings/usePctControl") && fbdo.dataType() == "boolean") {
    usePctControl = fbdo.boolData();
  }
  // Legacy raw threshold (if still present)
  if (Firebase.RTDB.getInt(&fbdo, "/settings/moistureThreshold") && fbdo.dataType() == "int") {
    legacyMoistureThresholdRaw = fbdo.intData();
  }

  // Basic sanity to avoid division by zero
  if (soilCal.dryRaw == soilCal.wetRaw) soilCal.dryRaw = soilCal.wetRaw + 200;
  if (soilCal.dryRaw < soilCal.wetRaw) {
    // swap if mis-ordered
    int tmp = soilCal.dryRaw; soilCal.dryRaw = soilCal.wetRaw; soilCal.wetRaw = tmp;
  }

  initializeFirebaseData();
  maybeConvertLegacyRawThreshold();
}

void initializeFirebaseData() {
  if (!Firebase.ready()) return;

  Firebase.RTDB.setFloat(&fbdo, "/sensors/temperature", 0.0);
  Firebase.RTDB.setFloat(&fbdo, "/sensors/humidity", 0.0);
  Firebase.RTDB.setInt(&fbdo,   "/sensors/soilMoisture", 0);           // raw
  Firebase.RTDB.setInt(&fbdo,   "/sensors/soilMoisturePercent", 0);    // calibrated %
  Firebase.RTDB.setBool(&fbdo,  "/sensors/soilPresent", true);
  Firebase.RTDB.setBool(&fbdo,  "/sensors/soilFault", false);

  Firebase.RTDB.setBool(&fbdo, "/actuators/pumpStatus", false);
  Firebase.RTDB.setBool(&fbdo, "/actuators/bulbStatus", true);

  Firebase.RTDB.setBool(&fbdo, "/controls/remotePumpControl", false);
  Firebase.RTDB.setBool(&fbdo, "/controls/remoteBulbControl", false);
  Firebase.RTDB.setBool(&fbdo, "/controls/remoteControlEnabled", true);
  Firebase.RTDB.setBool(&fbdo, "/controls/manualPumpCommand", false);
  Firebase.RTDB.setBool(&fbdo, "/controls/manualBulbCommand", true);
  Firebase.RTDB.setString(&fbdo, "/controls/pumpMode", "auto");
  Firebase.RTDB.setString(&fbdo, "/controls/bulbMode", "manual");
  Firebase.RTDB.setString(&fbdo, "/controls/calibrate", "NONE"); // DRY, WET, NONE

  Firebase.RTDB.setBool(&fbdo, "/system/deviceOnline", true);
  Firebase.RTDB.setString(&fbdo, "/system/deviceId", WiFi.macAddress());
  Firebase.RTDB.setString(&fbdo, "/system/version", "1.1-calibrated");
  Firebase.RTDB.setString(&fbdo, "/system/ipAddress", WiFi.localIP().toString());

  Firebase.RTDB.setInt(&fbdo, "/settings/soilCalibration/dryRaw", soilCal.dryRaw);
  Firebase.RTDB.setInt(&fbdo, "/settings/soilCalibration/wetRaw", soilCal.wetRaw);
  Firebase.RTDB.setInt(&fbdo, "/settings/moistureLowPct", moistureLowPct);
  Firebase.RTDB.setInt(&fbdo, "/settings/moistureHighPct", moistureHighPct);
  Firebase.RTDB.setBool(&fbdo, "/settings/usePctControl", usePctControl);

  // Keep legacy value for visibility
  Firebase.RTDB.setInt(&fbdo, "/settings/moistureThreshold", legacyMoistureThresholdRaw);
}

// Convert legacy raw threshold into percent (informational write)
void maybeConvertLegacyRawThreshold() {
  if (!usePctControl) return;
  // compute approximate equivalent percent for dashboard info (not used directly)
  int approxPct = pctFromRaw(legacyMoistureThresholdRaw);
  Firebase.RTDB.setInt(&fbdo, "/settings/legacyThresholdApproxPct", approxPct);
}

// ---------------- Main loop ----------------
void loop() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi disconnected, trying to reconnect...");
    firebaseConnected = false;
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    delay(5000);
    return;
  }

  if (now - sendDataPrevMillis >= sensorInterval) {
    sendDataPrevMillis = now;
    readSensors();
    applyPumpLogic(); // use freshly computed percent
  }

  if (firebaseConnected && (now - lastFirebaseUpdate >= firebaseInterval)) {
    lastFirebaseUpdate = now;
    updateFirebase();
  }

  if (firebaseConnected && (now - lastRemoteCheckTime >= remoteCheckInterval)) {
    lastRemoteCheckTime = now;
    checkRemoteCommands();
  }

  delay(50);
}

// ---------------- Sensors & Control ----------------
void readSensors() {
  Serial.println("📊 Reading sensors...");

  // DHT11
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (isnan(t) || isnan(h)) {
    Serial.println("❌ DHT11 failed, using previous/defaults");
    if (currentTemperature == 0.0 && currentHumidity == 0.0) {
      t = 25.0; h = 50.0;
    } else {
      t = currentTemperature; h = currentHumidity;
    }
  }
  currentTemperature = t;
  currentHumidity    = h;

  // Soil raw (median of many samples)
  int raw = readSoilRawMedian();
  currentSoilMoistureRaw = raw;

  // Probe presence / fault checks
  soilFault = false;
  soilPresent = true;

  if (raw >= PROBE_RAIL_HIGH - PROBE_MARGIN || raw <= PROBE_RAIL_LOW + PROBE_MARGIN) {
    // reading stuck near ADC rails indicates unplugged or wiring fault
    soilFault = true;
  }

  // Out-of-range w.r.t calibration window
  int minAccept = min(soilCal.wetRaw, soilCal.dryRaw) - OUT_OF_RANGE_MARGIN;
  int maxAccept = max(soilCal.wetRaw, soilCal.dryRaw) + OUT_OF_RANGE_MARGIN;
  if (raw < minAccept || raw > maxAccept) {
    // either not inserted in soil / air, or calibration far off
    soilPresent = false;
  }

  // Calibrated %
  int pct = pctFromRaw(raw);

  // Optional smoothing
  if (soilEMA < 0.0f) soilEMA = pct;
  soilEMA = EMA_ALPHA * pct + (1.0f - EMA_ALPHA) * soilEMA;
  currentSoilMoisturePct = constrain((int)roundf(soilEMA), 0, 100);

  Serial.printf("🌱 Soil RAW: %d | PCT(cal): %d%% [dry=%d, wet=%d]\n",
                raw, currentSoilMoisturePct, soilCal.dryRaw, soilCal.wetRaw);
  Serial.printf("   Presence=%s Fault=%s\n",
                soilPresent ? "YES" : "NO", soilFault ? "YES" : "NO");
}

// Hysteresis pump logic (prefers percent, falls back to raw)
void applyPumpLogic() {
  bool newPump = currentPumpStatus;

  if (remotePumpControl) {
    // Handled by checkRemoteCommands()
    return;
  }

  if (usePctControl) {
    // If sensor faulty or absent, fail-safe: do NOT run pump
    if (soilFault || !soilPresent) {
      newPump = false;
    } else {
      // Hysteresis
      if (!pumpLatchedOn && currentSoilMoisturePct <= moistureLowPct) {
        pumpLatchedOn = true;
      }
      if (pumpLatchedOn && currentSoilMoisturePct >= moistureHighPct) {
        pumpLatchedOn = false;
      }
      newPump = pumpLatchedOn;
    }
  } else {
    // Legacy raw threshold (no hysteresis)
    newPump = (currentSoilMoistureRaw > legacyMoistureThresholdRaw);
  }

  if (newPump != currentPumpStatus) {
    currentPumpStatus = newPump;
    digitalWrite(PUMP_RELAY_PIN, newPump ? LOW : HIGH);
    Serial.println(String("💦 PUMP: ") + (newPump ? "ON" : "OFF") +
                   String(usePctControl ? " (PCT control)" : " (RAW control)"));
  }

  // Bulb: keep your prior behavior (manual on unless remote)
  if (!remoteBulbControl) {
    if (!currentBulbStatus) {
      currentBulbStatus = true;
      digitalWrite(BULB_RELAY_PIN, LOW); // ON
      Serial.println("💡 BULB: Forced ON (Manual Mode)");
    }
  }
}

// ---------------- Firebase update ----------------
void updateFirebase() {
  if (!Firebase.ready()) {
    firebaseConnected = false;
    return;
  }

  Serial.println("📤 Updating Firebase...");

  bool ok = true;
  ok &= Firebase.RTDB.setFloat(&fbdo, "/sensors/temperature", currentTemperature);
  ok &= Firebase.RTDB.setFloat(&fbdo, "/sensors/humidity", currentHumidity);
  ok &= Firebase.RTDB.setInt(&fbdo,   "/sensors/soilMoisture", currentSoilMoistureRaw);
  ok &= Firebase.RTDB.setInt(&fbdo,   "/sensors/soilMoisturePercent", currentSoilMoisturePct);
  ok &= Firebase.RTDB.setBool(&fbdo,  "/sensors/soilPresent", soilPresent);
  ok &= Firebase.RTDB.setBool(&fbdo,  "/sensors/soilFault", soilFault);

  ok &= Firebase.RTDB.setBool(&fbdo, "/actuators/pumpStatus", currentPumpStatus);
  ok &= Firebase.RTDB.setBool(&fbdo, "/actuators/bulbStatus", currentBulbStatus);

  Firebase.RTDB.setString(&fbdo, "/controls/pumpMode", remotePumpControl ? "remote" : (usePctControl ? "auto_pct" : "auto_raw"));
  Firebase.RTDB.setString(&fbdo, "/controls/bulbMode", remoteBulbControl ? "remote" : "manual");

  Firebase.RTDB.setString(&fbdo, "/system/lastUpdate", String(millis()));
  Firebase.RTDB.setBool(&fbdo, "/system/deviceOnline", true);
  Firebase.RTDB.setString(&fbdo, "/system/uptime", String(millis()/1000) + " s");

  if (ok) {
    Serial.println("✅ Firebase update OK");
  } else {
    Serial.print("⚠️ Update partial fail: "); Serial.println(fbdo.errorReason());
  }
}

// ---------------- Remote commands & calibration ----------------
void checkRemoteCommands() {
  if (!Firebase.ready()) return;
  Serial.println("🔍 Checking remote commands...");

  // Master switch
  if (Firebase.RTDB.getBool(&fbdo, "/controls/remoteControlEnabled") && fbdo.dataType()=="boolean")
    remoteControlEnabled = fbdo.boolData();

  if (!remoteControlEnabled) {
    if (remotePumpControl || remoteBulbControl) {
      remotePumpControl = false; remoteBulbControl = false;
      Serial.println("📴 Remote disabled -> auto/manual");
    }
    return;
  }

  if (Firebase.RTDB.getBool(&fbdo, "/controls/remotePumpControl") && fbdo.dataType()=="boolean")
    remotePumpControl = fbdo.boolData();

  if (Firebase.RTDB.getBool(&fbdo, "/controls/remoteBulbControl") && fbdo.dataType()=="boolean")
    remoteBulbControl = fbdo.boolData();

  // Manual pump command when remote
  if (remotePumpControl) {
    if (Firebase.RTDB.getBool(&fbdo, "/controls/manualPumpCommand") && fbdo.dataType()=="boolean") {
      bool cmd = fbdo.boolData();
      if (cmd != currentPumpStatus) {
        currentPumpStatus = cmd;
        digitalWrite(PUMP_RELAY_PIN, cmd ? LOW : HIGH);
        Serial.println(String("🔄 Remote PUMP: ") + (cmd ? "ON" : "OFF"));
      }
    }
  }

  // Manual bulb command when remote
  if (remoteBulbControl) {
    if (Firebase.RTDB.getBool(&fbdo, "/controls/manualBulbCommand") && fbdo.dataType()=="boolean") {
      bool cmd = fbdo.boolData();
      if (cmd != currentBulbStatus) {
        currentBulbStatus = cmd;
        digitalWrite(BULB_RELAY_PIN, cmd ? LOW : HIGH);
        Serial.println(String("🔄 Remote BULB: ") + (cmd ? "ON" : "OFF"));
      }
    }
  }

  // Thresholds / modes
  if (Firebase.RTDB.getInt(&fbdo, "/settings/moistureLowPct") && fbdo.dataType()=="int")
    moistureLowPct = constrain(fbdo.intData(), 0, 100);
  if (Firebase.RTDB.getInt(&fbdo, "/settings/moistureHighPct") && fbdo.dataType()=="int")
    moistureHighPct = constrain(fbdo.intData(), 0, 100);
  if (Firebase.RTDB.getBool(&fbdo, "/settings/usePctControl") && fbdo.dataType()=="boolean")
    usePctControl = fbdo.boolData();

  // ====== NEW: Remote calibration ======
  if (Firebase.RTDB.getString(&fbdo, "/controls/calibrate") && fbdo.dataType()=="string") {
    String mode = fbdo.stringData(); // "DRY", "WET", "NONE"
    mode.toUpperCase();

    if (mode == "DRY" || mode == "WET") {
      Serial.println("🧪 Calibration requested: " + mode + " (sampling 64x)");
      // Take robust median of 64 samples
      const int N = 64;
      int buf[N];
      for (int i=0;i<N;i++){ buf[i]=analogRead(SOIL_PIN); delay(10); }
      // Simple selection: partial sort for median
      // For simplicity, reuse medianOf on first 33 entries twice
      int med = 0;
      // A quick full median (N is small)
      for (int i=0;i<N-1;i++){
        for (int j=i+1;j<N;j++){
          if (buf[j]<buf[i]) { int t=buf[i]; buf[i]=buf[j]; buf[j]=t; }
        }
      }
      med = (N%2==0)? ((buf[N/2-1]+buf[N/2])/2) : buf[N/2];

      if (mode == "DRY") {
        soilCal.dryRaw = med;
        Firebase.RTDB.setInt(&fbdo, "/settings/soilCalibration/dryRaw", soilCal.dryRaw);
        Firebase.RTDB.setString(&fbdo, "/controls/calibrate", "DONE-DRY");
        Serial.printf("✅ DRY calibrated to %d\n", soilCal.dryRaw);
      } else {
        soilCal.wetRaw = med;
        Firebase.RTDB.setInt(&fbdo, "/settings/soilCalibration/wetRaw", soilCal.wetRaw);
        Firebase.RTDB.setString(&fbdo, "/controls/calibrate", "DONE-WET");
        Serial.printf("✅ WET calibrated to %d\n", soilCal.wetRaw);
      }

      // Keep ordering sane
      if (soilCal.dryRaw < soilCal.wetRaw) {
        int tmp=soilCal.dryRaw; soilCal.dryRaw=soilCal.wetRaw; soilCal.wetRaw=tmp;
        Firebase.RTDB.setInt(&fbdo, "/settings/soilCalibration/dryRaw", soilCal.dryRaw);
        Firebase.RTDB.setInt(&fbdo, "/settings/soilCalibration/wetRaw", soilCal.wetRaw);
      }
    }
  }

  Serial.println("✅ Remote check done");
}

// ---------------- Utilities ----------------
int medianOf(int *arr, int n) {
  // in-place selection sort (n small)
  for (int i=0;i<n-1;i++){
    for (int j=i+1;j<n;j++){
      if (arr[j] < arr[i]) { int t=arr[i]; arr[i]=arr[j]; arr[j]=t; }
    }
  }
  if (n%2==0) return (arr[n/2-1] + arr[n/2]) / 2;
  return arr[n/2];
}

int readSoilRawMedian() {
  int buf[SOIL_SAMPLES];
  for (int i=0;i<SOIL_SAMPLES;i++) {
    buf[i] = analogRead(SOIL_PIN);
    delay(8);
  }
  return medianOf(buf, SOIL_SAMPLES);
}

// Linear mapping using calibration points (dry->0%, wet->100%)
int pctFromRaw(int raw) {
  // Ensure dryRaw > wetRaw (enforced earlier)
  long num = (long)soilCal.dryRaw - (long)raw;
  long den = (long)soilCal.dryRaw - (long)soilCal.wetRaw;
  if (den == 0) den = 1;
  long pct = (num * 100L) / den;
  // clamp
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return (int)pct;
}
