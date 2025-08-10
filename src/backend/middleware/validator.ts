/**
 * Validation middleware for MCP requests
 */

import { JSONRPCRequest, ValidationError } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Validates incoming JSON-RPC requests according to MCP protocol
 */
export function validateRequest(req: any): req is JSONRPCRequest {
  try {
    // Check JSON-RPC version
    if (req.jsonrpc !== '2.0') {
      throw new ValidationError('Invalid JSON-RPC version. Expected "2.0"');
    }

    // Check required fields
    if (!req.method || typeof req.method !== 'string') {
      throw new ValidationError('Missing or invalid "method" field');
    }

    if (req.id === undefined || req.id === null) {
      throw new ValidationError('Missing "id" field');
    }

    // Validate method-specific parameters
    if (req.method === 'triggerPopup') {
      return validateTriggerPopupParams(req.params);
    }

    if (req.method === 'healthCheck') {
      return true; // Health check requires no params
    }

    throw new ValidationError(`Unknown method: ${req.method}`);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new ValidationError(`Request validation failed: ${errorMessage}`);
  }
}

/**
 * Validates parameters for triggerPopup method
 */
function validateTriggerPopupParams(params: any): boolean {
  if (!params || typeof params !== 'object') {
    throw new ValidationError('Missing or invalid "params" object');
  }

  // Validate workspacePath
  if (!params.workspacePath || typeof params.workspacePath !== 'string') {
    throw new ValidationError('Missing or invalid "workspacePath" parameter');
  }

  // Validate title
  if (!params.title || typeof params.title !== 'string') {
    throw new ValidationError('Missing or invalid "title" parameter');
  }

  // Validate message
  if (!params.message || typeof params.message !== 'string') {
    throw new ValidationError('Missing or invalid "message" parameter');
  }

  // Validate options
  if (!Array.isArray(params.options)) {
    throw new ValidationError('Missing or invalid "options" parameter (must be array)');
  }

  if (params.options.length === 0) {
    throw new ValidationError('At least one option is required');
  }

  // Validate each option
  for (let i = 0; i < params.options.length; i++) {
    const option = params.options[i];
    if (!option || typeof option !== 'object') {
      throw new ValidationError(`Invalid option at index ${i} (must be object)`);
    }
    
    if (!option.label || typeof option.label !== 'string') {
      throw new ValidationError(`Invalid option at index ${i}: missing or invalid "label"`);
    }
    
    if (!option.value || typeof option.value !== 'string') {
      throw new ValidationError(`Invalid option at index ${i}: missing or invalid "value"`);
    }
  }

  return true;
}

/**
 * Validates request origin for security (HTTP requests only)
 */
export function validateOrigin(origin: string | undefined): boolean {
  // For localhost development, allow any origin
  // In production, this should be more restrictive
  if (origin === undefined) {
    return true; // Allow requests without origin (e.g., from tools)
  }
  
  if (origin === '') {
    return false; // Reject empty string origins
  }

  // Allow localhost and 127.0.0.1
  const allowedOrigins = [
    'http://localhost',
    'http://127.0.0.1',
    'https://localhost',
    'https://127.0.0.1'
  ];

  return allowedOrigins.some(allowed => origin.startsWith(allowed));
}

/**
 * Request guard for additional security checks
 */
export function requestGuard(req: any, origin?: string): boolean {
  try {
    // Validate request structure
    validateRequest(req);

    // Validate origin for HTTP requests
    if (origin !== undefined && !validateOrigin(origin)) {
      throw new ValidationError('Invalid request origin');
    }

    return true;
  } catch (error) {
    // Log security violations
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Request guard failed:', errorMessage);
    throw error;
  }
}
