# 📘 SaHa Development Standards & AI Agent Guidelines

**Version:** 2.0
**Created On:** 2025-01-02
**Updated On:** 2026-04-07
**Maintainer:** DMBOD Product & Architecture Team

---

## 🧭 1. General Development Philosophy

| Principle | Rule |
|----------|------|
| ✅ Clarity First | Prioritize readable, clean, maintainable code. Avoid clever hacks. |
| ✅ Enterprise Standard | Treat this like a production SaaS platform. No "playground" shortcuts. |
| ✅ Long-Term View | Never favor speed over sustainability. No hard-coded hacks or band-aids. |
| ✅ Responsibility | Every module should fail gracefully, log clearly, and be testable. |
| ✅ Domain Expertise | Understand carbon footprint calculations and construction industry standards. |

---

## 📐 2. Architecture & Structure

- ✅ Use modular and decoupled architecture (controller-service-repository pattern)
- ✅ Each module must be reusable, documented, and unit testable
- ❌ Do not use inline logic in React pages/components
- ✅ State must be stored consistently (Database → API → React Query → UI)
- ✅ Feature flags or configuration-driven design is preferred
- ✅ Separate business logic from UI components
- ✅ Use TypeScript interfaces for all data structures
- ✅ Implement proper error boundaries in React components

### **File Organization Standards**
```
client/src/
├── components/       # Reusable UI components
├── pages/           # Route components
├── hooks/           # Custom React hooks
├── lib/             # Utility functions
└── types/           # TypeScript type definitions

server/
├── routes/          # API route handlers
├── services/        # Business logic
├── models/          # Database models
└── utils/           # Server utilities
```

---

## 📱 3. Mobile Responsiveness

- ✅ All components must be responsive by default
- ✅ Use Tailwind's mobile-first breakpoints (`sm`, `md`, `lg`, `xl`)
- ✅ Test layout on:
  - Mobile (iPhone SE/12 equivalent)
  - Tablet (iPad equivalent)
  - Desktop (Full HD)
- ❌ Never assume desktop-only interactions (e.g., hover menus without fallback)
- ✅ Touch-friendly interface elements (minimum 44px touch targets)
- ✅ Optimize data loading for mobile networks

---

## 🔐 4. Security Standards

- ✅ Always use HTTPS APIs
- ✅ Sanitize all inputs at:
  - Client (basic validation)
  - Server/API (strict validation and sanitization)
- ✅ Validate authentication tokens on all sensitive routes
- ✅ Use role-based access control (admin, estimator, viewer)
- ✅ Strip personally identifiable information (PII) before storing logs
- ❌ Never expose API keys or tokens to the client
- ✅ Implement rate limiting on API endpoints
- ✅ Use parameterized queries to prevent SQL injection
- ✅ Validate all file uploads and restrict file types

---

## 🧪 5. Bug Handling & Root Cause Analysis

- ✅ Do not fix bugs without first logging the cause
- ✅ All bugs must include:
  - Root cause (where & why it failed)
  - Fix description (what was changed)
  - Risk of side effects
  - Test cases to prevent regression
- ✅ Every fix must be regression-tested for surrounding functionality
- ❌ Never introduce a fix that breaks another feature
- ✅ Use proper error logging with context information
- ✅ Implement graceful error handling with user-friendly messages

---

## 🛠 6. Enhancement Guidelines

- ✅ All enhancements must be backward compatible
- ✅ Use feature toggles or flags if making major logic changes
- ✅ Consider user experience (UX) before technical implementation
- ✅ Document all API/DB/Logic changes in the release notes
- ✅ Follow the SaHa Implementation Guide for feature prioritization
- ✅ Validate business logic with domain experts
- ✅ Consider performance impact of new features

---

## 📁 7. Code Quality & Style

- ✅ Follow Prettier + ESLint formatting rules
- ✅ All functions/components must have:
  - A clear, descriptive name
  - Input/output type definitions
  - Optional inline comments (if logic is non-obvious)
  - JSDoc comments for public APIs
- ✅ Use React functional components with hooks
- ❌ Avoid long files (> 250 LOC per file ideally)
- ✅ Split complex logic into utils/hooks/services
- ✅ Use meaningful variable and function names
- ✅ Remove console.log statements before production
- ✅ Use const assertions for literal types

### **Naming Conventions**
```typescript
// Components: PascalCase
const ProjectDialog = () => {};

// Functions: camelCase
const calculateEmissions = () => {};

// Constants: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Types/Interfaces: PascalCase
interface ProjectData {}
type EmissionFactor = number;
```

---

## 📈 8. Database & Data Flow

- ✅ All tables must have:
  - Primary key (preferably UUID)
  - created_at, updated_at columns
  - Indexed foreign keys (if used in joins)
  - Proper constraints and validations
- ✅ Use PostgreSQL with Drizzle ORM for type safety
- ✅ Migrations should be incremental and reversible
- ✅ Use transactions for multi-table operations
- ✅ Implement soft deletes where appropriate
- ✅ Use proper indexing for query optimization
- ✅ Validate data integrity at database level

### **DMBOD Specific Database Rules**
- ✅ All emission calculations must be auditable
- ✅ Material data must include source references

- ✅ Use decimal types for precise emission calculations

---

## 🔌 9. API Standards

- ✅ Use RESTful conventions:
  - GET /api/resource
  - POST /api/resource
  - PUT /api/resource/:id
  - DELETE /api/resource/:id
- ✅ Validate all request payloads (types, structure, auth)
- ✅ Return consistent error formats:
  ```json
  {
    "success": false,
    "message": "Human readable error",
    "code": "ERROR_CODE",
    "field": "fieldName" // if field-specific
  }
  ```
- ✅ Use proper HTTP status codes
- ✅ Implement pagination for list endpoints
- ✅ Add request/response logging for debugging
- ✅ Use middleware for common operations (auth, validation, logging)

### **DMBOD API Specific Rules**
- ✅ Emission calculations must return detailed breakdowns
- ✅ Material endpoints must include emission factors
- ✅ Project endpoints must support phase-based filtering
- ✅ Include calculation metadata in responses

---

## 🧠 10. AI Agent Specific Rules

| Area | Rule |
|------|------|
| 🧠 Context Awareness | Always analyze existing codebase patterns before implementing |
| 🧠 Ask Before Major Changes | Prompt user for confirmation before significant architectural changes |
| 🧠 Respect Standards | All generated code must follow SaHa coding standards |
| 🧠 Log Changes | Clearly document what was added/modified and reasoning |
| 🧠 Prefer Durable Fixes | Avoid temporary hacks, setTimeout fixes, or duplicate logic |
| 🧠 Test Considerations | Suggest test cases for new functionality |
| 🧠 Performance Awareness | Consider performance implications of proposed changes |
| 🧠 Domain Knowledge | Understand carbon footprint calculation principles |

### **AI Agent Decision Framework**
1. **Analyze**: Review existing code patterns and architecture
2. **Plan**: Consider multiple implementation approaches
3. **Validate**: Ensure solution aligns with project goals
4. **Implement**: Write clean, maintainable code
5. **Test**: Suggest testing approach and edge cases
6. **Document**: Explain changes and rationale

---

## 🌱 11. DMBOD Domain-Specific Standards - Take only appropriate rules based on the current development architecture ( updated on 6th April 2026)

### **Carbon Footprint Calculations**
- ✅ Use scientifically accurate emission factors
- ✅ Include calculation methodology in documentation
- ✅ Validate against industry standards (ICE Database, EPA guidelines)
- ✅ Handle regional variations in emission factors
- ✅ Account for material transportation distances
- ✅ Include waste factors in calculations

### **Construction Industry Standards**
- ✅ Support standard construction phases
- ✅ Use industry-standard material categories
- ✅ Integrate with common construction workflows
- ✅ Support BOQ (Bill of Quantities) formats
- ✅ Handle material substitutions and alternatives

### **Data Validation Rules**
```typescript
// Example validation patterns
const projectValidation = {
  buildingArea: z.number().positive().max(1000000), // sq ft
  floors: z.number().int().positive().max(200),
  constructionMethod: z.enum(['traditional', 'prefab', 'modular']),
  climateZone: z.string().regex(/^[1-8][A-C]$/) // ASHRAE zones
};
```

---

## 📦 12. Testing Standards

- ✅ Unit tests for all business logic functions
- ✅ Integration tests for API endpoints
- ✅ Component tests for React components
- ✅ E2E tests for critical user journeys
- ✅ Test emission calculation accuracy
- ✅ Mock external dependencies
- ✅ Maintain >80% code coverage

### **Test Organization**
```
tests/
├── unit/           # Pure function tests
├── integration/    # API endpoint tests
├── components/     # React component tests
└── e2e/           # End-to-end scenarios
```

---

## 🚀 13. Performance Standards

- ✅ Page load times < 2 seconds
- ✅ API response times < 500ms
- ✅ Optimize database queries with proper indexing
- ✅ Use React Query for efficient caching
- ✅ Implement lazy loading for large components
- ✅ Optimize bundle size with code splitting
- ✅ Use proper image optimization

---

## 📊 14. Monitoring & Analytics

- ✅ Log all emission calculations for audit trails
- ✅ Monitor API performance and error rates
- ✅ Track user engagement metrics
- ✅ Implement health checks for critical services
- ✅ Monitor database performance
- ✅ Track calculation accuracy metrics

---

## 📋 15. Deployment & DevOps Standards

- ✅ Use environment-specific configurations
- ✅ Implement proper CI/CD pipelines
- ✅ Use blue-green deployment for zero downtime
- ✅ Maintain staging environment for testing
- ✅ Backup database regularly
- ✅ Monitor application health in production
- ✅ Use Replit for development and deployment

---



---

## 📝 17. Documentation Requirements

- ✅ API documentation with examples
- ✅ Component storybook for UI elements
- ✅ Database schema documentation
- ✅ Calculation methodology documentation
- ✅ User guides and tutorials
- ✅ Developer onboarding documentation

---

## 🔄 18. Code Review Checklist

### **Before Submitting Code**
- [ ] Code follows style guidelines
- [ ] All functions have proper TypeScript types
- [ ] Error handling is implemented
- [ ] Tests are written and passing
- [ ] Documentation is updated
- [ ] Performance considerations reviewed
- [ ] Security implications assessed
- [ ] Mobile responsiveness verified

### **Review Criteria**
- [ ] Code readability and maintainability
- [ ] Proper error handling
- [ ] Security best practices followed
- [ ] Performance optimizations considered
- [ ] Test coverage adequate
- [ ] Documentation complete

---

## 📧 19. Communication Standards

- ✅ Use clear, descriptive commit messages
- ✅ Document breaking changes prominently
- ✅ Communicate API changes to frontend team
- ✅ Update project status regularly
- ✅ Share performance benchmarks
- ✅ Report security concerns immediately

---

## 🏆 20. Success Metrics

### **Technical Metrics**
- Code quality score > 8.0/10
- Test coverage > 80%
- Page load time < 2 seconds
- API response time < 500ms
- Zero critical security vulnerabilities

### **Business Metrics**
- Calculation accuracy ±5% of industry standards
- User adoption rate > 80%
- Data completeness > 95%
- Customer satisfaction > 4.5/5

---

**This enhanced manifesto serves as the comprehensive guide for all DMBOD development activities. Every feature, calculation, and interface decision should align with these standards to ensure we build a world-class carbon footprint tracking platform.**

**Version 2.0 Updates:**
- Added AI Agent specific guidelines
- Enhanced DMBOD domain-specific standards
- Expanded testing and performance requirements
- Added implementation priorities alignment
- Included comprehensive code review checklist