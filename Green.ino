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
#define DHTPIN 27               // DHT11 data pin
#define DHTTYPE DHT11
#define SOIL_PIN 32             // Soil Moisture Sensor on analog GPIO32
#define BULB_RELAY_PIN 4        // Light Bulb Relay (initially ON)
#define PUMP_RELAY_PIN 14       // Water Pump Relay (controlled by soil moisture)

// ----- Sensor Setup -----
DHT dht(DHTPIN, DHTTYPE);
int moistureThreshold = 2000; // Adjust this based on testing (0=wet, 4095=dry) - can be updated remotely

// ----- Firebase Objects -----
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Timing variables
unsigned long sendDataPrevMillis = 0;
unsigned long sensorInterval = 2000;  // Read sensors every 2 seconds
unsigned long firebaseInterval = 5000; // Update Firebase every 5 seconds
unsigned long lastFirebaseUpdate = 0;

// Firebase connection status
bool firebaseConnected = false;

// Global variables to store current sensor values
float currentTemperature = 0.0;
float currentHumidity = 0.0;
int currentSoilMoisture = 0;
bool currentPumpStatus = false;
bool currentBulbStatus = true;

// Remote control variables
bool remotePumpControl = false;  // When true, pump is controlled remotely
bool remoteBulbControl = false;  // When true, bulb is controlled remotely
bool remoteControlEnabled = true; // Master switch for remote control

// Last time we checked for remote commands
unsigned long lastRemoteCheckTime = 0;
unsigned long remoteCheckInterval = 3000; // Check every 3 seconds

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("=== ESP32 SMART FARMING SYSTEM ===");
  
  // Initialize hardware
  dht.begin();
  pinMode(BULB_RELAY_PIN, OUTPUT);
  pinMode(PUMP_RELAY_PIN, OUTPUT);

  // Relay startup states
  digitalWrite(BULB_RELAY_PIN, LOW);  // Relay ON (active LOW)
  digitalWrite(PUMP_RELAY_PIN, HIGH); // Relay OFF (active LOW)
  currentBulbStatus = true;  // Track bulb state
  currentPumpStatus = false; // Track pump state

  Serial.println("✅ Hardware initialized");
  Serial.println("💡 Bulb is ON by default");

  // Connect to WiFi
  connectToWiFi();
  
  // Initialize Firebase
  initializeFirebase();
  
  Serial.println("=== Setup Complete ===");
  Serial.println("Firebase Status: " + String(firebaseConnected ? "✅ READY" : "❌ FAILED"));
  Serial.println("Starting main loop...\n");
}

void connectToWiFi() {
  Serial.println("📶 Connecting to WiFi...");
  Serial.println("SSID: " + String(WIFI_SSID));
  
  // Removed the placeholder check since we have real credentials now
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int wifiAttempts = 0;
  
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 30) {
    delay(1000);
    Serial.print(".");
    wifiAttempts++;
    
    // Print status every 10 attempts
    if (wifiAttempts % 10 == 0) {
      Serial.println("\nStill trying to connect... (" + String(wifiAttempts) + "/30)");
    }
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected successfully!");
    Serial.print("📡 IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("📶 Signal strength: ");
    Serial.println(WiFi.RSSI());
  } else {
    Serial.println("\n❌ WiFi connection failed!");
    Serial.println("Please check:");
    Serial.println("- WiFi name: " + String(WIFI_SSID));
    Serial.println("- Password is correct");
    Serial.println("- Router is 2.4GHz (ESP32 doesn't support 5GHz)");
    Serial.println("- ESP32 is within range");
    while(1) {
      delay(5000);
      Serial.println("Retrying WiFi connection...");
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      delay(10000);
    }
  }
}

void initializeFirebase() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ Cannot initialize Firebase - WiFi not connected");
    return;
  }
  
  Serial.println("🔥 Initializing Firebase...");
  
  // Debug: Print credentials being used
  Serial.println("=== Firebase Configuration ===");
  Serial.print("🔑 API Key: ");
  Serial.println(API_KEY);
  Serial.print("🗄️ Database URL: ");
  Serial.println(DATABASE_URL);
  Serial.println("==============================");
  
  // Configure Firebase with explicit settings
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  
  // Set token status callback
  config.token_status_callback = tokenStatusCallback;
  
  // Set maximum retry attempts
  config.max_token_generation_retry = 5;
  
  // For anonymous authentication
  Serial.println("🔐 Attempting anonymous authentication...");
  
  // Try anonymous signup first
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("✅ Anonymous signup successful");
  } else {
    Serial.print("⚠️ Anonymous signup failed: ");
    Serial.println(config.signer.signupError.message.c_str());
    Serial.println("🔄 Trying direct initialization...");
  }
  
  // Initialize Firebase
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  // Wait for Firebase to initialize with timeout
  Serial.println("⏳ Waiting for Firebase connection...");
  int attempts = 0;
  while (!Firebase.ready() && attempts < 30) {
    delay(1000);
    attempts++;
    Serial.print(".");
    
    // Print status every 5 attempts
    if (attempts % 5 == 0) {
      Serial.println("\n🔄 Still connecting to Firebase... (" + String(attempts) + "/30)");
    }
  }
  
  if (Firebase.ready()) {
    Serial.println("\n✅ Firebase connected successfully!");
    firebaseConnected = true;
    
    // Test Firebase connection with a simple write
    Serial.println("🧪 Testing Firebase connection...");
    if (Firebase.RTDB.setString(&fbdo, "/system/status", "ESP32 Smart Farming Online - " + String(millis()))) {
      Serial.println("✅ Firebase test write successful");
    } else {
      Serial.print("⚠️ Firebase test write failed: ");
      Serial.println(fbdo.errorReason().c_str());
    }
    
    // Initialize default values in Firebase
    initializeFirebaseData();
    
  } else {
    Serial.println("\n❌ Firebase connection failed!");
    Serial.println("🔍 Possible issues:");
    Serial.println("- Check API key and Database URL");
    Serial.println("- Verify Firebase project settings");
    Serial.println("- Check internet connection");
    firebaseConnected = false;
    Serial.println("📱 System will continue without Firebase (local operation only)");
  }
}

void initializeFirebaseData() {
  if (!Firebase.ready()) {
    Serial.println("❌ Cannot initialize Firebase data - not ready");
    return;
  }
  
  Serial.println("🔧 Initializing Firebase data structure...");
  
  // Initialize sensor data structure
  Firebase.RTDB.setFloat(&fbdo, "/sensors/temperature", 0.0);
  Firebase.RTDB.setFloat(&fbdo, "/sensors/humidity", 0.0);
  Firebase.RTDB.setInt(&fbdo, "/sensors/soilMoisture", 0);
  Firebase.RTDB.setInt(&fbdo, "/sensors/soilMoisturePercent", 0);
  
  // Initialize actuator status
  Firebase.RTDB.setBool(&fbdo, "/actuators/pumpStatus", false);
  Firebase.RTDB.setBool(&fbdo, "/actuators/bulbStatus", true);
  
  // Initialize remote control settings
  Firebase.RTDB.setBool(&fbdo, "/controls/remotePumpControl", false);
  Firebase.RTDB.setBool(&fbdo, "/controls/remoteBulbControl", false);
  Firebase.RTDB.setBool(&fbdo, "/controls/remoteControlEnabled", true);
  Firebase.RTDB.setBool(&fbdo, "/controls/manualPumpCommand", false);
  Firebase.RTDB.setBool(&fbdo, "/controls/manualBulbCommand", true);
  
  // Initialize control mode (auto/manual)
  Firebase.RTDB.setString(&fbdo, "/controls/pumpMode", "auto");
  Firebase.RTDB.setString(&fbdo, "/controls/bulbMode", "manual");
  
  // Initialize system status
  Firebase.RTDB.setBool(&fbdo, "/system/deviceOnline", true);
  Firebase.RTDB.setString(&fbdo, "/system/deviceId", WiFi.macAddress());
  Firebase.RTDB.setString(&fbdo, "/system/version", "1.0");
  Firebase.RTDB.setString(&fbdo, "/system/lastUpdate", String(millis()));
  Firebase.RTDB.setString(&fbdo, "/system/ipAddress", WiFi.localIP().toString());
  
  // Initialize settings
  Firebase.RTDB.setInt(&fbdo, "/settings/moistureThreshold", moistureThreshold);
  Firebase.RTDB.setString(&fbdo, "/settings/sensorInterval", String(sensorInterval));
  Firebase.RTDB.setString(&fbdo, "/settings/firebaseInterval", String(firebaseInterval));
  
  Serial.println("✅ Firebase data structure initialized successfully");
}

void loop() {
  unsigned long currentMillis = millis();
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi disconnected, attempting reconnection...");
    firebaseConnected = false;
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    delay(5000);
    return;
  }
  
  // Read sensors periodically
  if (currentMillis - sendDataPrevMillis >= sensorInterval) {
    sendDataPrevMillis = currentMillis;
    readSensors();
  }
  
  // Update Firebase periodically
  if (firebaseConnected && (currentMillis - lastFirebaseUpdate >= firebaseInterval)) {
    lastFirebaseUpdate = currentMillis;
    updateFirebase();
  }
  
  // Check for remote commands periodically
  if (firebaseConnected && (currentMillis - lastRemoteCheckTime >= remoteCheckInterval)) {
    lastRemoteCheckTime = currentMillis;
    checkRemoteCommands();
  }
  
  delay(100); // Small delay to prevent watchdog issues
}

void readSensors() {
  Serial.println("📊 Reading sensors...");
  
  // --- DHT11 Reading with validation ---
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("❌ Failed to read from DHT11!");
    // Use previous valid values or defaults
    if (currentTemperature == 0.0) {
      temperature = 25.0; // Default temperature
      humidity = 50.0;    // Default humidity
    } else {
      temperature = currentTemperature; // Use last valid reading
      humidity = currentHumidity;
    }
    Serial.println("🔄 Using previous/default values");
  } else {
    Serial.print("🌡️ Temperature: ");
    Serial.print(temperature, 1);
    Serial.print(" °C | 💧 Humidity: ");
    Serial.print(humidity, 1);
    Serial.println(" %");
  }

  // --- Soil Moisture Reading ---
  int soilValue = analogRead(SOIL_PIN); // 0 (wet) to 4095 (dry)
  int moisturePercent = map(soilValue, 4095, 0, 0, 100); // Convert to percentage
  moisturePercent = constrain(moisturePercent, 0, 100);
  
  Serial.print("🌱 Soil Moisture Raw: ");
  Serial.print(soilValue);
  Serial.print(" | Percentage: ");
  Serial.print(moisturePercent);
  Serial.println("%");

  // --- Control Pump Based on Soil Moisture or Remote Command ---
  bool pumpStatus = currentPumpStatus; // Keep current status by default
  
  if (remotePumpControl) {
    // Remote control mode - pump controlled by app
    Serial.println("💻 Pump in REMOTE control mode");
    // pumpStatus is set by checkRemoteCommands() function
  } else {
    // Automatic control mode - pump controlled by soil moisture
    Serial.println("🤖 Pump in AUTO control mode");
    if (soilValue > moistureThreshold) {
      Serial.println("⚠️ Soil is dry (below " + String(moistureThreshold) + "). Turning ON water pump.");
      pumpStatus = true;
    } else {
      Serial.println("✅ Soil is moist (above " + String(moistureThreshold) + "). Turning OFF water pump.");
      pumpStatus = false;
    }
  }
  
  // Apply pump control (Active LOW Relay)
  if (pumpStatus != currentPumpStatus) {
    if (pumpStatus) {
      digitalWrite(PUMP_RELAY_PIN, LOW); // Turn ON Pump (active LOW)
      Serial.println("💦 PUMP: ON");
    } else {
      digitalWrite(PUMP_RELAY_PIN, HIGH); // Turn OFF Pump
      Serial.println("💦 PUMP: OFF");
    }
  }
  
  // --- Control Bulb Based on Remote Command ---
  bool bulbStatus = currentBulbStatus; // Keep current status by default
  
  if (remoteBulbControl) {
    // Remote control mode - bulb controlled by app
    Serial.println("💻 Bulb in REMOTE control mode");
    // bulbStatus is already updated by checkRemoteCommands() function
    bulbStatus = currentBulbStatus;
  } else {
    // Manual mode - bulb always on by default (can be changed in app)
    Serial.println("🔧 Bulb in MANUAL mode (always on)");
    bulbStatus = true;
    
    // Apply bulb control immediately in manual mode
    if (bulbStatus != currentBulbStatus) {
      digitalWrite(BULB_RELAY_PIN, LOW); // Turn ON Bulb (active LOW)
      Serial.println("💡 BULB: Forced ON (Manual Mode)");
      currentBulbStatus = bulbStatus;
    }
  }
  
  // Apply bulb control (Active LOW Relay) - only if in remote mode
  if (remoteBulbControl && bulbStatus != currentBulbStatus) {
    if (bulbStatus) {
      digitalWrite(BULB_RELAY_PIN, LOW); // Turn ON Bulb (active LOW)
      Serial.println("💡 BULB: ON (Remote Command)");
    } else {
      digitalWrite(BULB_RELAY_PIN, HIGH); // Turn OFF Bulb
      Serial.println("💡 BULB: OFF (Remote Command)");
    }
    currentBulbStatus = bulbStatus;
  }

  // Store values for Firebase update
  currentTemperature = temperature;
  currentHumidity = humidity;
  currentSoilMoisture = soilValue;
  currentPumpStatus = pumpStatus;
  currentBulbStatus = bulbStatus;
  
  // Print summary
  Serial.println("📋 Current Status:");
  Serial.println("   🌡️ Temp: " + String(temperature, 1) + "°C");
  Serial.println("   💧 Humidity: " + String(humidity, 1) + "%");
  Serial.println("   🌱 Soil: " + String(moisturePercent) + "% (" + String(soilValue) + ")");
  Serial.println("   💦 Pump: " + String(pumpStatus ? "ON" : "OFF") + " (" + String(remotePumpControl ? "REMOTE" : "AUTO") + ")");
  Serial.println("   💡 Bulb: " + String(bulbStatus ? "ON" : "OFF") + " (" + String(remoteBulbControl ? "REMOTE" : "MANUAL") + ")");
  Serial.println("------------------------------------------------");
}

void updateFirebase() {
  if (!Firebase.ready()) {
    Serial.println("⚠️ Firebase not ready, skipping update");
    firebaseConnected = false;
    return;
  }
  
  Serial.println("📤 Updating Firebase...");
  bool allUpdatesSuccessful = true;
  
  // Update sensor data
  if (!Firebase.RTDB.setFloat(&fbdo, "/sensors/temperature", currentTemperature)) {
    Serial.print("❌ Failed to update temperature: ");
    Serial.println(fbdo.errorReason().c_str());
    allUpdatesSuccessful = false;
  }
  
  if (!Firebase.RTDB.setFloat(&fbdo, "/sensors/humidity", currentHumidity)) {
    Serial.print("❌ Failed to update humidity: ");
    Serial.println(fbdo.errorReason().c_str());
    allUpdatesSuccessful = false;
  }
  
  if (!Firebase.RTDB.setInt(&fbdo, "/sensors/soilMoisture", currentSoilMoisture)) {
    Serial.print("❌ Failed to update soil moisture: ");
    Serial.println(fbdo.errorReason().c_str());
    allUpdatesSuccessful = false;
  }
  
  // Calculate and update soil moisture percentage
  int moisturePercent = map(currentSoilMoisture, 4095, 0, 0, 100);
  moisturePercent = constrain(moisturePercent, 0, 100);
  if (!Firebase.RTDB.setInt(&fbdo, "/sensors/soilMoisturePercent", moisturePercent)) {
    Serial.print("❌ Failed to update soil moisture percentage: ");
    Serial.println(fbdo.errorReason().c_str());
    allUpdatesSuccessful = false;
  }
  
  // Update actuator status
  if (!Firebase.RTDB.setBool(&fbdo, "/actuators/pumpStatus", currentPumpStatus)) {
    Serial.print("❌ Failed to update pump status: ");
    Serial.println(fbdo.errorReason().c_str());
    allUpdatesSuccessful = false;
  }
  
  // Update bulb status
  if (!Firebase.RTDB.setBool(&fbdo, "/actuators/bulbStatus", currentBulbStatus)) {
    Serial.print("❌ Failed to update bulb status: ");
    Serial.println(fbdo.errorReason().c_str());
    allUpdatesSuccessful = false;
  }
  
  // Update control modes
  Firebase.RTDB.setString(&fbdo, "/controls/pumpMode", remotePumpControl ? "remote" : "auto");
  Firebase.RTDB.setString(&fbdo, "/controls/bulbMode", remoteBulbControl ? "remote" : "manual");
  
  // Update system status
  Firebase.RTDB.setString(&fbdo, "/system/lastUpdate", String(millis()));
  Firebase.RTDB.setBool(&fbdo, "/system/deviceOnline", true);
  Firebase.RTDB.setString(&fbdo, "/system/uptime", String(millis() / 1000) + " seconds");
  
  if (allUpdatesSuccessful) {
    Serial.println("✅ Firebase update completed successfully!");
    Serial.println("📊 Data uploaded:");
    Serial.println("   🌡️ Temperature: " + String(currentTemperature, 1) + "°C");
    Serial.println("   💧 Humidity: " + String(currentHumidity, 1) + "%");
    Serial.println("   🌱 Soil: " + String(moisturePercent) + "% (" + String(currentSoilMoisture) + ")");
    Serial.println("   💦 Pump: " + String(currentPumpStatus ? "ON" : "OFF") + " (" + String(remotePumpControl ? "REMOTE" : "AUTO") + ")");
    Serial.println("   💡 Bulb: " + String(currentBulbStatus ? "ON" : "OFF") + " (" + String(remoteBulbControl ? "REMOTE" : "MANUAL") + ")");
  } else {
    Serial.println("⚠️ Some Firebase updates failed - check connection");
  }
  
  Serial.println("================================================");
}

void checkRemoteCommands() {
  if (!Firebase.ready()) {
    Serial.println("🔍 Firebase not ready for remote commands");
    return;
  }
  
  Serial.println("🔍 Checking for remote commands...");
  
  // Check if remote control is enabled
  if (Firebase.RTDB.getBool(&fbdo, "/controls/remoteControlEnabled")) {
    if (fbdo.dataType() == "boolean") {
      bool newRemoteControlEnabled = fbdo.boolData();
      if (newRemoteControlEnabled != remoteControlEnabled) {
        remoteControlEnabled = newRemoteControlEnabled;
        Serial.println("🔄 Remote control master switch: " + String(remoteControlEnabled ? "ENABLED" : "DISABLED"));
      }
    }
  } else {
    Serial.println("⚠️ Failed to read remoteControlEnabled: " + fbdo.errorReason());
  }
  
  if (!remoteControlEnabled) {
    // If remote control is disabled, set everything to auto/manual mode
    if (remotePumpControl || remoteBulbControl) {
      remotePumpControl = false;
      remoteBulbControl = false;
      Serial.println("📴 Remote control disabled - switching to auto/manual modes");
    }
    return;
  }
  
  // Check pump remote control status
  if (Firebase.RTDB.getBool(&fbdo, "/controls/remotePumpControl")) {
    if (fbdo.dataType() == "boolean") {
      bool newRemotePumpControl = fbdo.boolData();
      if (newRemotePumpControl != remotePumpControl) {
        remotePumpControl = newRemotePumpControl;
        Serial.println("🔄 Pump control mode changed to: " + String(remotePumpControl ? "REMOTE" : "AUTO"));
      }
    }
  } else {
    Serial.println("⚠️ Failed to read remotePumpControl: " + fbdo.errorReason());
  }
  
  // Check bulb remote control status
  if (Firebase.RTDB.getBool(&fbdo, "/controls/remoteBulbControl")) {
    if (fbdo.dataType() == "boolean") {
      bool newRemoteBulbControl = fbdo.boolData();
      if (newRemoteBulbControl != remoteBulbControl) {
        remoteBulbControl = newRemoteBulbControl;
        Serial.println("🔄 Bulb control mode changed to: " + String(remoteBulbControl ? "REMOTE" : "MANUAL"));
      }
    }
  } else {
    Serial.println("⚠️ Failed to read remoteBulbControl: " + fbdo.errorReason());
  }
  
  // If pump is in remote control mode, check for manual commands
  if (remotePumpControl) {
    if (Firebase.RTDB.getBool(&fbdo, "/controls/manualPumpCommand")) {
      if (fbdo.dataType() == "boolean") {
        bool newPumpCommand = fbdo.boolData();
        Serial.println("📱 Read pump command from Firebase: " + String(newPumpCommand ? "ON" : "OFF"));
        if (newPumpCommand != currentPumpStatus) {
          currentPumpStatus = newPumpCommand;
          Serial.println("🔄 Executing remote pump command: " + String(currentPumpStatus ? "ON" : "OFF"));
          
          // Apply the command immediately
          if (currentPumpStatus) {
            digitalWrite(PUMP_RELAY_PIN, LOW); // Turn ON Pump (active LOW)
            Serial.println("✅ Pump relay set to LOW (ON)");
          } else {
            digitalWrite(PUMP_RELAY_PIN, HIGH); // Turn OFF Pump
            Serial.println("✅ Pump relay set to HIGH (OFF)");
          }
        }
      }
    } else {
      Serial.println("⚠️ Failed to read manualPumpCommand: " + fbdo.errorReason());
    }
  }
  
  // If bulb is in remote control mode, check for manual commands
  if (remoteBulbControl) {
    if (Firebase.RTDB.getBool(&fbdo, "/controls/manualBulbCommand")) {
      if (fbdo.dataType() == "boolean") {
        bool newBulbCommand = fbdo.boolData();
        Serial.println("📱 Read bulb command from Firebase: " + String(newBulbCommand ? "ON" : "OFF"));
        if (newBulbCommand != currentBulbStatus) {
          currentBulbStatus = newBulbCommand;
          Serial.println("🔄 Executing remote bulb command: " + String(currentBulbStatus ? "ON" : "OFF"));
          
          // Apply the command immediately
          if (currentBulbStatus) {
            digitalWrite(BULB_RELAY_PIN, LOW); // Turn ON Bulb (active LOW)
            Serial.println("✅ Bulb relay set to LOW (ON)");
          } else {
            digitalWrite(BULB_RELAY_PIN, HIGH); // Turn OFF Bulb
            Serial.println("✅ Bulb relay set to HIGH (OFF)");
          }
        } else {
          Serial.println("ℹ️ Bulb command unchanged: " + String(currentBulbStatus ? "ON" : "OFF"));
        }
      }
    } else {
      Serial.println("⚠️ Failed to read manualBulbCommand: " + fbdo.errorReason());
    }
  }
  
  // Check for threshold updates
  if (Firebase.RTDB.getInt(&fbdo, "/settings/moistureThreshold")) {
    if (fbdo.dataType() == "int") {
      int newThreshold = fbdo.intData();
      if (newThreshold != moistureThreshold && newThreshold > 0 && newThreshold < 4095) {
        moistureThreshold = newThreshold;
        Serial.println("🔄 Moisture threshold updated to: " + String(moistureThreshold));
      }
    }
  } else {
    Serial.println("⚠️ Failed to read moistureThreshold: " + fbdo.errorReason());
  }
  
  Serial.println("✅ Remote command check completed");
}

// Note: tokenStatusCallback is already defined in TokenHelper.h, so we don't need to define it here