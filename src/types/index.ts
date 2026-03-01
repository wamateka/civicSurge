export type UserRole = 'VOLUNTEER' | 'ADMIN';
export type EventType = 'FLOOD' | 'TORNADO' | 'SNOW' | 'WILDFIRE' | 'GENERAL';
export type EventStatus = 'ACTIVE' | 'CLOSED';
export type DeploymentStatus = 'NOTIFIED' | 'ACCEPTED' | 'DECLINED' | 'TIMED_OUT' | 'CHECKED_IN';

export const AVAILABLE_SKILLS = [
  'First Aid',
  'CPR Certified',
  'Search & Rescue',
  'Firefighting',
  'Multilingual',
  'Leadership/Coordination',
  'Elderly/Disability Care',
  'Animal Rescue',
  'Hazmat Handling',
  'General Labor',
] as const;

export type Skill = (typeof AVAILABLE_SKILLS)[number];

export const AVAILABLE_RESOURCES = [
  'Pickup Truck',
  'SUV/4WD Vehicle',
  'Chainsaw',
  'Snow Plow',
  'Generator',
  'Boat/Kayak',
  'First Aid Kit',
  'Power Tools',
  'Sandbags',
  'Water Pump',
] as const;

export type Resource = (typeof AVAILABLE_RESOURCES)[number];

export const EVENT_TYPE_SKILLS: Record<EventType, string[]> = {
  FLOOD:    ['First Aid', 'Search & Rescue', 'General Labor'],
  TORNADO:  ['Search & Rescue', 'First Aid', 'General Labor'],
  SNOW:     ['General Labor', 'Leadership/Coordination'],
  WILDFIRE: ['Firefighting', 'First Aid', 'General Labor'],
  GENERAL:  ['General Labor', 'Leadership/Coordination', 'First Aid'],
};

export const EVENT_TYPE_RESOURCES: Record<EventType, string[]> = {
  FLOOD:    ['Boat/Kayak', 'Water Pump', 'Sandbags'],
  TORNADO:  ['Chainsaw', 'Power Tools', 'Generator'],
  SNOW:     ['Snow Plow', 'SUV/4WD Vehicle', 'Generator'],
  WILDFIRE: ['Generator', 'First Aid Kit'],
  GENERAL:  [],
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  FLOOD:    '#3b82f6',
  TORNADO:  '#8b5cf6',
  SNOW:     '#06b6d4',
  WILDFIRE: '#ef4444',
  GENERAL:  '#f59e0b',
};

export const EVENT_TYPE_ICONS: Record<EventType, string> = {
  FLOOD:    '🌊',
  TORNADO:  '🌪️',
  SNOW:     '❄️',
  WILDFIRE: '🔥',
  GENERAL:  '⚠️',
};

export const SENSOR_THRESHOLDS = {
  water_level: { threshold: 80,  eventType: 'FLOOD'    as EventType, unit: '%' },
  wind_speed:  { threshold: 95,  eventType: 'TORNADO'  as EventType, unit: 'mph' },
  temperature: { threshold: 110, eventType: 'WILDFIRE' as EventType, unit: '°F' },
  snow_depth:  { threshold: 24,  eventType: 'SNOW'     as EventType, unit: 'in' },
};

export interface VolunteerWithUser {
  id: string;
  userId: string;
  phone: string;
  latitude: number;
  longitude: number;
  address: string | null;
  skills: string[];
  resources: string[];
  isAvailable: boolean;
  createdAt: string;
  user: { id: string; name: string; email: string; role: UserRole };
}

export interface SurgeEventData {
  id: string;
  title: string;
  type: EventType;
  severity: number;
  status: EventStatus;
  latitude: number;
  longitude: number;
  radiusKm: number;
  skillsNeeded: string[];
  resourcesNeeded: string[];
  headcount: number;
  filledCount: number;
  autoTriggered: boolean;
  createdBy: string;
  createdAt: string;
  closedAt: string | null;
  deployments?: DeploymentWithDetails[];
}

export interface DeploymentWithDetails {
  id: string;
  volunteerId: string;
  surgeEventId: string;
  distanceKm: number;
  status: DeploymentStatus;
  notifiedAt: string;
  respondedAt: string | null;
  volunteer: VolunteerWithUser;
  surgeEvent: SurgeEventData;
}

export interface SensorReadingData {
  id: string;
  sensorId: string;
  latitude: number;
  longitude: number;
  type: string;
  value: number;
  threshold: number;
  triggeredSurgeId: string | null;
  timestamp: string;
}

// Socket.io event payloads
export interface SocketEvents {
  'surge:created':        { surgeEvent: SurgeEventData };
  'surge:mobilized':      { surgeEventId: string; deployments: DeploymentWithDetails[]; result: MatchingResult };
  'surge:auto-triggered': {
    sensorType: string;
    latitude: number;
    longitude: number;
    value: number;
    threshold: number;
    surgeEvent: SurgeEventData;
    result: MatchingResult;
  };
  'deployment:updated':   { deployment: DeploymentWithDetails };
  'sensor:reading':       { reading: SensorReadingData };
}

export interface MatchingResult {
  needed: number;
  notified: number;
  overNotifiedBy: number;
  searchRadiusKm: number;
  avgDistanceKm: number | null;
  nearestKm: number | null;
  farthestKm: number | null;
  expanded: boolean;
  skillCoverage: Record<string, number>;
  resourceCoverage: Record<string, number>;
}
