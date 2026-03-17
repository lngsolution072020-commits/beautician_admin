const axios = require('axios');
const env = require('../config/env');

// Utility functions for geo-location and ETA related logic

/**
 * Build a GeoJSON Point object from latitude and longitude.
 */
const buildPoint = (lat, lng) => ({
  type: 'Point',
  coordinates: [lng, lat]
});

/**
 * Haversine distance between two points in km.
 * Each point: { coordinates: [lng, lat] } or [lng, lat].
 */
const getDistanceInKm = (pointA, pointB) => {
  const coordsA = pointA?.coordinates || pointA;
  const coordsB = pointB?.coordinates || pointB;
  if (!coordsA?.length || !coordsB?.length) return null;
  const [lngA, latA] = coordsA;
  const [lngB, latB] = coordsB;
  const R = 6371; // Earth radius km
  const dLat = ((latB - latA) * Math.PI) / 180;
  const dLng = ((lngB - lngA) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((latA * Math.PI) / 180) * Math.cos((latB * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
};

/**
 * Placeholder for ETA calculation using Google Maps Distance Matrix API.
 * In production, handle quota limits, error cases and caching.
 */
const getEtaBetweenPoints = async ({ origin, destination }) => {
  if (!env.googleMaps.apiKey) {
    // If API key is not configured, return a mocked ETA.
    return {
      etaInMinutes: 15,
      distanceInKm: 5
    };
  }

  const params = {
    origins: `${origin.lat},${origin.lng}`,
    destinations: `${destination.lat},${destination.lng}`,
    key: env.googleMaps.apiKey
  };

  const url = 'https://maps.googleapis.com/maps/api/distancematrix/json';

  const response = await axios.get(url, { params });
  const row = response.data.rows?.[0];
  const element = row?.elements?.[0];

  if (!element || element.status !== 'OK') {
    return {
      etaInMinutes: 15,
      distanceInKm: 5
    };
  }

  const etaInMinutes = Math.round(element.duration.value / 60);
  const distanceInKm = parseFloat((element.distance.value / 1000).toFixed(2));

  return { etaInMinutes, distanceInKm };
};

module.exports = {
  buildPoint,
  getEtaBetweenPoints,
  getDistanceInKm
};

