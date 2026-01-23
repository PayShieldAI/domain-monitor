const domainService = require('../../src/services/domainService');
const domainRepository = require('../../src/repositories/domainRepository');
const AppError = require('../../src/utils/AppError');

// Mock dependencies
jest.mock('../../src/repositories/domainRepository');
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('DomainService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockDomain = {
    id: 'domain-123',
    user_id: 'user-123',
    domain: 'example.com',
    name: 'Example Corp',
    status: 'active',
    recommendation: 'pass',
    industry: 'Technology',
    business_type: 'Corporation',
    founded_year: 2015,
    provider: 'truebiz',
    check_frequency: '7',
    last_checked_at: new Date(),
    next_check_at: new Date(),
    created_at: new Date(),
    updated_at: new Date()
  };

  describe('addDomain', () => {
    it('should add a new domain successfully', async () => {
      domainRepository.findByDomainAndUserId.mockResolvedValue(null);
      domainRepository.create.mockResolvedValue(mockDomain);

      const result = await domainService.addDomain('user-123', 'example.com', '7');

      expect(domainRepository.findByDomainAndUserId).toHaveBeenCalledWith('example.com', 'user-123');
      expect(domainRepository.create).toHaveBeenCalledWith({
        userId: 'user-123',
        domain: 'example.com',
        checkFrequency: '7'
      });
      expect(result.domain).toBe('example.com');
      expect(result.status).toBe('active');
    });

    it('should throw error if domain already exists', async () => {
      domainRepository.findByDomainAndUserId.mockResolvedValue(mockDomain);

      await expect(
        domainService.addDomain('user-123', 'example.com', '7')
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'DOMAIN_EXISTS'
      });
    });
  });

  describe('addDomainsBulk', () => {
    it('should add multiple domains and return results', async () => {
      const domains = [
        { domain: 'example1.com', checkFrequency: '7' },
        { domain: 'example2.com', checkFrequency: '30' }
      ];

      domainRepository.bulkCreate.mockResolvedValue({
        success: [
          { ...mockDomain, domain: 'example1.com' },
          { ...mockDomain, domain: 'example2.com' }
        ],
        failed: []
      });

      const result = await domainService.addDomainsBulk('user-123', domains);

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.total).toBe(2);
    });

    it('should handle partial failures', async () => {
      domainRepository.bulkCreate.mockResolvedValue({
        success: [mockDomain],
        failed: [{ domain: 'duplicate.com', error: 'Domain already exists' }]
      });

      const result = await domainService.addDomainsBulk('user-123', [
        { domain: 'example.com' },
        { domain: 'duplicate.com' }
      ]);

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
    });
  });

  describe('getDomain', () => {
    it('should return domain for valid id', async () => {
      domainRepository.findByIdAndUserId.mockResolvedValue(mockDomain);

      const result = await domainService.getDomain('user-123', 'domain-123');

      expect(result.id).toBe('domain-123');
      expect(result.domain).toBe('example.com');
    });

    it('should throw error for non-existent domain', async () => {
      domainRepository.findByIdAndUserId.mockResolvedValue(null);

      await expect(
        domainService.getDomain('user-123', 'nonexistent')
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DOMAIN_NOT_FOUND'
      });
    });
  });

  describe('listDomains', () => {
    it('should return paginated domains', async () => {
      domainRepository.findByUserId.mockResolvedValue({
        domains: [mockDomain],
        total: 1
      });

      const result = await domainService.listDomains('user-123', {
        page: 1,
        limit: 20
      });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should pass filter options to repository', async () => {
      domainRepository.findByUserId.mockResolvedValue({
        domains: [],
        total: 0
      });

      await domainService.listDomains('user-123', {
        page: 1,
        limit: 20,
        status: 'active',
        recommendation: 'fail'
      });

      expect(domainRepository.findByUserId).toHaveBeenCalledWith('user-123', {
        page: 1,
        limit: 20,
        status: 'active',
        recommendation: 'fail'
      });
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring successfully', async () => {
      domainRepository.findByIdAndUserId.mockResolvedValue(mockDomain);
      domainRepository.updateStatus.mockResolvedValue({
        ...mockDomain,
        status: 'inactive'
      });

      const result = await domainService.stopMonitoring('user-123', 'domain-123');

      expect(domainRepository.updateStatus).toHaveBeenCalledWith('domain-123', 'inactive');
      expect(result.status).toBe('inactive');
    });

    it('should throw error for non-existent domain', async () => {
      domainRepository.findByIdAndUserId.mockResolvedValue(null);

      await expect(
        domainService.stopMonitoring('user-123', 'nonexistent')
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DOMAIN_NOT_FOUND'
      });
    });
  });

  describe('startMonitoring', () => {
    it('should restart monitoring successfully', async () => {
      domainRepository.findByIdAndUserId.mockResolvedValue({
        ...mockDomain,
        status: 'inactive'
      });
      domainRepository.restartMonitoring.mockResolvedValue({
        ...mockDomain,
        status: 'active'
      });

      const result = await domainService.startMonitoring('user-123', 'domain-123');

      expect(domainRepository.restartMonitoring).toHaveBeenCalledWith('domain-123');
      expect(result.status).toBe('active');
    });
  });

  describe('stopMonitoringBulk', () => {
    it('should stop multiple domains', async () => {
      domainRepository.bulkUpdateStatus.mockResolvedValue({
        updated: ['domain-1', 'domain-2'],
        notFound: ['domain-3']
      });

      const result = await domainService.stopMonitoringBulk('user-123', [
        'domain-1',
        'domain-2',
        'domain-3'
      ]);

      expect(result.updated).toHaveLength(2);
      expect(result.notFound).toHaveLength(1);
    });
  });

  describe('formatDomainResponse', () => {
    it('should format domain correctly', () => {
      const result = domainService.formatDomainResponse(mockDomain);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('domain');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('recommendation');
      expect(result).toHaveProperty('businessType');
      expect(result).not.toHaveProperty('user_id');
      expect(result).not.toHaveProperty('raw_data');
    });
  });
});
