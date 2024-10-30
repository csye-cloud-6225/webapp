const StatsD = require('hot-shots');

// Initialize StatsD client
const statsd = new StatsD({
  host: process.env.STATSD_HOST || '127.0.0.1', 
  port: process.env.STATSD_PORT || 8125,        
  prefix: 'webapp.',                            
  global_tags: { env: process.env.NODE_ENV }    
});

/**
 * Increment a counter metric
 * @param {string} metricName - The name of the metric
 * @param {object} tags - Optional: Tags for the metric
 */
function increment(metricName, tags = {}) {
  statsd.increment(metricName, tags);
}

/**
 * Timing metric
 * @param {string} metricName - The name of the metric
 * @param {number} duration - Duration in milliseconds
 * @param {object} tags - Optional: Tags for the metric
 */
function timing(metricName, duration, tags = {}) {
  statsd.timing(metricName, duration, tags);
}

module.exports = { increment, timing };
