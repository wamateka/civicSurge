/**
 * CivicSurge IoT Sensor Simulator
 * Connects to MQTT broker and publishes escalating sensor readings.
 * Run: npm run iot:simulate
 *
 * Values drift upward with randomness, eventually crossing thresholds
 * to trigger automatic surge events.
 */

import mqtt from 'mqtt';

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://test.mosquitto.org:1883';
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

const SENSORS = [
  { id: 'sensor-downtown', name: 'Downtown Manhattan', latitude: 40.7128, longitude: -74.0060 },
  { id: 'sensor-midtown', name: 'Midtown Manhattan', latitude: 40.7549, longitude: -73.9840 },
  { id: 'sensor-uptown', name: 'Upper Manhattan', latitude: 40.7831, longitude: -73.9712 },
  { id: 'sensor-brooklyn', name: 'Brooklyn Heights', latitude: 40.6892, longitude: -73.9904 },
  { id: 'sensor-queens', name: 'Astoria Queens', latitude: 40.7721, longitude: -73.9302 },
];

const SENSOR_CONFIGS = [
  { type: 'water_level', threshold: 80, unit: '%', eventType: 'FLOOD', startMin: 15, startMax: 35 },
  { type: 'wind_speed', threshold: 95, unit: 'mph', eventType: 'TORNADO', startMin: 10, startMax: 30 },
  { type: 'temperature', threshold: 110, unit: 'F', eventType: 'WILDFIRE', startMin: 75, startMax: 90 },
  { type: 'snow_depth', threshold: 24, unit: 'in', eventType: 'SNOW', startMin: 1, startMax: 8 },
];

interface SensorState {
  sensorId: string;
  sensorName: string;
  latitude: number;
  longitude: number;
  type: string;
  value: number;
  threshold: number;
  unit: string;
  triggered: boolean;
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function formatBar(value: number, threshold: number, width = 20): string {
  const pct = Math.min(1, value / (threshold * 1.1));
  const filled = Math.floor(pct * width);
  const bar = '='.repeat(filled) + '-'.repeat(width - filled);
  return bar;
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     CivicSurge IoT Sensor Simulator          ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`Sensors: ${SENSORS.length} locations`);
  console.log(`Connecting to MQTT: ${BROKER_URL}`);
  console.log('');

  const client = mqtt.connect(BROKER_URL, {
    clientId: `civicsurge_iot_sim_${Date.now()}`,
    clean: true,
    reconnectPeriod: 5000,
  });

  // Pick one dominant sensor (will escalate faster to trigger an event)
  const dominantSensor = SENSORS[Math.floor(Math.random() * SENSORS.length)];
  const dominantConfig = SENSOR_CONFIGS[Math.floor(Math.random() * SENSOR_CONFIGS.length)];

  // Initialize sensor states — one reading type per sensor location
  const sensorStates: SensorState[] = SENSORS.flatMap((sensor) =>
    SENSOR_CONFIGS.map((cfg) => ({
      sensorId: sensor.id,
      sensorName: sensor.name,
      latitude: sensor.latitude,
      longitude: sensor.longitude,
      type: cfg.type,
      value: randomBetween(cfg.startMin, cfg.startMax),
      threshold: cfg.threshold,
      unit: cfg.unit,
      triggered: false,
    }))
  );

  console.log(`Dominant sensor: ${dominantConfig.type} at ${dominantSensor.name}`);
  console.log(`Will escalate to trigger ${dominantConfig.eventType} event`);
  console.log('');

  client.on('connect', () => {
    console.log('Connected to MQTT broker\n');
    console.log('Publishing readings every 3 seconds...\n');
    console.log('Press Ctrl+C to stop\n');
    console.log('-'.repeat(60));

    let tick = 0;

    setInterval(async () => {
      tick++;

      for (const state of sensorStates) {
        const isDominant = state.sensorId === dominantSensor.id && state.type === dominantConfig.type;

        let delta: number;
        if (isDominant) {
          delta = randomBetween(3, 8);
        } else {
          delta = randomBetween(-2, 3);
        }

        state.value = Math.max(0, state.value + delta);
        state.value = Math.min(state.value, state.threshold * 1.2);

        const payload = {
          sensorId: state.sensorId,
          latitude: state.latitude,
          longitude: state.longitude,
          type: state.type,
          value: parseFloat(state.value.toFixed(2)),
          threshold: state.threshold,
          timestamp: new Date().toISOString(),
        };

        const topic = `civicsurge/sensors/${state.sensorId}`;
        client.publish(topic, JSON.stringify(payload));

        // Also POST directly to API for immediate processing
        try {
          await fetch(`${APP_URL}/api/sensors/reading`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } catch {
          // App not running, just using MQTT
        }
      }

      // Print status table every 3 ticks (9 seconds)
      if (tick % 3 === 0) {
        console.clear();
        console.log(`CivicSurge IoT Simulator — Tick ${tick}`);
        console.log('-'.repeat(60));

        for (const sensor of SENSORS) {
          const isDominantSensor = sensor.id === dominantSensor.id;
          console.log(`\n${isDominantSensor ? '>>' : '  '} ${sensor.name} (${sensor.latitude}, ${sensor.longitude})`);

          const states = sensorStates.filter((s) => s.sensorId === sensor.id);
          for (const state of states) {
            const exceeded = state.value >= state.threshold;
            const isDom = sensor.id === dominantSensor.id && state.type === dominantConfig.type;
            const bar = formatBar(state.value, state.threshold);
            const flag = exceeded ? ' THRESHOLD!' : isDom ? ' (escalating)' : '';

            console.log(
              `  ${exceeded ? '!!' : isDom ? '>>' : '  '} ${state.type.padEnd(15)} [${bar}] ${state.value.toFixed(1).padStart(6)} ${state.unit}${flag}`
            );
          }
        }

        console.log('\n' + '-'.repeat(60));
        console.log(`MQTT topic: civicsurge/sensors/<sensor_id>`);
        console.log('API endpoint: POST /api/sensors/reading');
      }
    }, 3000);
  });

  client.on('error', (err) => {
    console.error('MQTT Error:', err.message);
  });

  client.on('close', () => {
    console.log('Disconnected from broker');
  });

  process.on('SIGINT', () => {
    console.log('\n\nShutting down IoT simulator...');
    client.end();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
