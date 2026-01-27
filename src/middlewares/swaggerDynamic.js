const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const config = require('../config');

/**
 * Factory function to create Swagger YAML middleware for a specific file
 * @param {string} filename - Name of the swagger YAML file (e.g., 'swagger.yaml')
 * @returns {Function} Express middleware function
 */
function createSwaggerMiddleware(filename) {
  return function serveDynamicSwagger(_req, res) {
    try {
      const swaggerPath = path.join(__dirname, '../../docs', filename);
      const swaggerContent = fs.readFileSync(swaggerPath, 'utf8');

      // Parse YAML
      const swaggerDoc = yaml.load(swaggerContent);

      // Get the appropriate API base URL for current environment
      const apiBaseUrl = config.getApiBaseUrl();
      const environmentName = config.env.charAt(0).toUpperCase() + config.env.slice(1);

      // Update servers section based on environment
      swaggerDoc.servers = [
        {
          url: apiBaseUrl,
          description: `${environmentName} server`
        }
      ];

      // Convert back to YAML
      const modifiedYaml = yaml.dump(swaggerDoc);

      // Set proper headers for YAML
      res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
      res.send(modifiedYaml);
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'SWAGGER_ERROR',
          message: 'Failed to load API documentation'
        }
      });
    }
  };
}

module.exports = createSwaggerMiddleware;
