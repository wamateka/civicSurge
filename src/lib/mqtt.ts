import mqtt from 'mqtt';

let client: mqtt.MqttClient | null = null;

export function getMqttClient(): mqtt.MqttClient | null {
  return client;
}

export function initMqtt(): void {
  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://test.mosquitto.org:1883';

  console.log(`[MQTT] Connecting to ${brokerUrl}...`);

  client = mqtt.connect(brokerUrl, {
    clientId: `civicsurge_server_${Date.now()}`,
    clean: true,
    reconnectPeriod: 10000,
    connectTimeout: 10000,
  });

  client.on('connect', () => {
    console.log('[MQTT] Connected to broker');
    client!.subscribe('civicsurge/sensors/#', (err) => {
      if (err) console.error('[MQTT] Subscribe error:', err);
      else console.log('[MQTT] Subscribed to civicsurge/sensors/#');
    });
  });

  client.on('message', async (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

      // POST to our internal API endpoint
      const response = await fetch(`${appUrl}/api/sensors/reading`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mqtt-internal': 'true',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('[MQTT] API call failed:', response.status, text);
      }
    } catch (error) {
      console.error('[MQTT] Message handling error:', error);
    }
  });

  client.on('error', (err) => {
    console.error('[MQTT] Error:', err.message);
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...');
  });

  client.on('offline', () => {
    console.log('[MQTT] Client offline');
  });
}

export function publishSensorReading(
  sensorId: string,
  latitude: number,
  longitude: number,
  type: string,
  value: number,
  threshold: number
): void {
  if (!client || !client.connected) {
    console.log('[MQTT] Not connected, skipping publish');
    return;
  }

  const payload = JSON.stringify({
    sensorId,
    latitude,
    longitude,
    type,
    value,
    threshold,
    timestamp: new Date().toISOString(),
  });

  client.publish(`civicsurge/sensors/${sensorId}`, payload, (err) => {
    if (err) console.error('[MQTT] Publish error:', err);
  });
}
