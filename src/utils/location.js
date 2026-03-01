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
  getEtaBetweenPoints
};

