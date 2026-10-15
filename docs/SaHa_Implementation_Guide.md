# 🌍 SaHa Emissions Calculation Engine - Implementation Guide

## 📋 Project Overview

**Vision**: Transform SaHa from a basic prototype to a production-ready carbon footprint tracking system for the construction industry.

**Current Status**: Prototype with minimal test data (11 users, 3 projects, 46 materials) - Direct implementation approach approved.

---

## 🎯 Implementation Strategy

### **Core Approach**
- **Direct Foundation Implementation**: No migrations needed due to minimal test data
- **Phased Development**: 4 phases over 8 weeks
- **Preserve User Data**: Only real data worth keeping
- **Enhanced Schema**: Implement advanced data structures directly

---

## 📊 Phase Implementation Plan

### **Phase 1: Enhanced Foundation (Week 1-2)**
*Direct schema implementation with advanced data structures*

#### Database Strategy
- **Drop and recreate** projects, materials, project_materials tables
- **Preserve** users table (real data)
- **Implement** enhanced schema with building specifications
- **Create** project phases system
- **Add** advanced material properties

#### Enhanced Database Schema
```sql
-- Enhanced projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  type TEXT NOT NULL,
  status VARCHAR DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
  
  -- Building specifications
  building_area REAL,
  floors INTEGER,
  building_height REAL,
  climate_zone TEXT,
  construction_method TEXT,
  expected_duration INTEGER,
  soil_conditions TEXT,
  building_code TEXT,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Project phases table
CREATE TABLE project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed')),
  phase_percentage REAL DEFAULT 0 CHECK (phase_percentage >= 0 AND phase_percentage <= 100),
  description TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Enhanced materials table
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  emission_factor REAL NOT NULL,
  source TEXT,
  
  -- Advanced material properties
  density REAL DEFAULT 1.0,
  waste_factor_min REAL DEFAULT 0.05,
  waste_factor_max REAL DEFAULT 0.15,
  transportation_factor REAL DEFAULT 0.1,
  installation_emissions REAL DEFAULT 0.0,
  
  created_at TIMESTAMP DEFAULT now()
);

-- Enhanced project materials table
CREATE TABLE project_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id),
  phase_id UUID REFERENCES project_phases(id),
  quantity REAL NOT NULL,
  
  -- Advanced calculation factors
  supplier_distance REAL DEFAULT 0,
  waste_factor REAL DEFAULT 0.1,
  installation_method TEXT,
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT now()
);

-- Material suppliers table
CREATE TABLE material_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  contact_info JSONB,
  average_distance REAL,
  created_at TIMESTAMP DEFAULT now()
);

-- Emission calculations cache
CREATE TABLE emission_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_material_id UUID REFERENCES project_materials(id),
  material_emission REAL,
  transportation_emission REAL,
  installation_emission REAL,
  waste_emission REAL,
  regional_emission REAL,
  total_emission REAL,
  calculated_at TIMESTAMP DEFAULT now()
);
```

#### TypeScript Schema Updates
```typescript
// Enhanced project interface
interface EnhancedProject {
  id: string;
  userId: string;
  name: string;
  location: string;
  type: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  
  // Building specifications
  buildingArea?: number;
  floors?: number;
  buildingHeight?: number;
  climateZone?: string;
  constructionMethod?: string;
  expectedDuration?: number;
  soilConditions?: string;
  buildingCode?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
}

// Project phases
interface ProjectPhase {
  id: string;
  projectId: string;
  name: string;
  startDate?: Date;
  endDate?: Date;
  status: 'planned' | 'active' | 'completed';
  phasePercentage: number;
  description?: string;
  createdAt?: Date;
}

// Enhanced material properties
interface EnhancedMaterial {
  id: string;
  displayId: string;
  name: string;
  category: string;
  unit: string;
  emissionFactor: number;
  source?: string;
  
  // Advanced properties
  density: number;
  wasteFactorMin: number;
  wasteFactorMax: number;
  transportationFactor: number;
  installationEmissions: number;
  
  createdAt?: Date;
}

// Enhanced project materials
interface EnhancedProjectMaterial {
  id: string;
  projectId: string;
  materialId: string;
  phaseId?: string;
  quantity: number;
  
  // Advanced factors
  supplierDistance: number;
  wasteFactor: number;
  installationMethod?: string;
  notes?: string;
  
  createdAt?: Date;
}

// Emission calculation result
interface EmissionCalculation {
  materialEmission: number;
  transportationEmission: number;
  installationEmission: number;
  wasteEmission: number;
  regionalEmission: number;
  totalEmission: number;
}
```

#### Advanced Calculation Engine
```typescript
function calculateAdvancedEmissions(
  projectMaterial: EnhancedProjectMaterial,
  material: EnhancedMaterial,
  project: EnhancedProject
): EmissionCalculation {
  // Base material emission
  const baseEmission = projectMaterial.quantity * material.emissionFactor;
  
  // Transportation emissions (distance × weight × transport factor)
  const transportEmission = calculateTransportation(
    projectMaterial.quantity,
    material.density,
    projectMaterial.supplierDistance,
    material.transportationFactor
  );
  
  // Installation/equipment emissions
  const installationEmission = calculateInstallation(
    material.category,
    projectMaterial.quantity,
    projectMaterial.installationMethod,
    material.installationEmissions
  );
  
  // Waste factor emissions (project-specific or material default)
  const wasteEmission = baseEmission * projectMaterial.wasteFactor;
  
  // Regional climate adjustments
  const regionalEmission = applyRegionalFactors(baseEmission, project.climateZone);
  
  return {
    materialEmission: baseEmission,
    transportationEmission: transportEmission,
    installationEmission: installationEmission,
    wasteEmission: wasteEmission,
    regionalEmission: regionalEmission,
    totalEmission: baseEmission + transportEmission + installationEmission + wasteEmission + regionalEmission
  };
}

// Helper calculation functions
function calculateTransportation(
  quantity: number,
  density: number,
  distance: number,
  transportFactor: number
): number {
  const weight = quantity * density;
  return weight * distance * transportFactor;
}

function calculateInstallation(
  category: string,
  quantity: number,
  method: string,
  baseInstallationEmissions: number
): number {
  const categoryMultipliers = {
    'Concrete': 1.2,
    'Steel': 1.5,
    'Timber': 0.8,
    'Insulation': 1.0,
    'Other': 1.0
  };
  
  const methodMultipliers = {
    'Manual': 0.8,
    'Mechanical': 1.0,
    'Crane': 1.3,
    'Prefab': 0.9
  };
  
  const categoryMultiplier = categoryMultipliers[category] || 1.0;
  const methodMultiplier = methodMultipliers[method] || 1.0;
  
  return quantity * baseInstallationEmissions * categoryMultiplier * methodMultiplier;
}

function applyRegionalFactors(baseEmission: number, climateZone: string): number {
  const regionalFactors = {
    'Tropical': 1.1,
    'Temperate': 1.0,
    'Cold': 1.2,
    'Arid': 1.05
  };
  
  const factor = regionalFactors[climateZone] || 1.0;
  return baseEmission * (factor - 1.0);
}
```

### **Phase 2: Material Assignment Workflow (Week 3-4)**
*Enable project-material relationships with phase-based tracking*

#### API Endpoints
- `GET /api/projects/:id/phases` - Get project phases
- `POST /api/projects/:id/phases` - Create project phase
- `GET /api/projects/:id/materials` - Get project materials by phase
- `POST /api/projects/:id/materials` - Add material to project
- `PUT /api/projects/:id/materials/:materialId` - Update material assignment
- `DELETE /api/projects/:id/materials/:materialId` - Remove material
- `GET /api/projects/:id/emissions` - Get project emission calculations

#### New UI Components
- Project Materials Management page (`/projects/{id}/materials`)
- Enhanced Project Creation form with building specifications
- Phase management interface
- Material assignment workflow
- Real-time calculation displays

### **Phase 3: Advanced User Experience (Week 5-6)**
*Transform data input from complex to intuitive*

#### Features
- Bill of Quantities (BOQ) import system
- Advanced dashboard with optimization recommendations
- Comprehensive reporting suite
- Material substitution suggestions

### **Phase 4: Production Readiness (Week 7-8)**
*Polish for production deployment*

#### Focus Areas
- Performance optimization
- Comprehensive testing
- Documentation and training materials
- Security audit

---

## 📋 Implementation Rules

### **Data Integrity Rules**
1. Never allow material assignment without emission factors
2. Validate all quantity inputs against reasonable ranges
3. Maintain audit trails for all calculations
4. Implement real-time validation for critical fields

### **Performance Rules**
1. Cache emission calculations for large projects
2. Implement progressive loading for material lists
3. Use database indexes for frequent queries
4. Optimize API calls with batching

### **User Experience Rules**
1. Provide immediate feedback on data input
2. Show calculation breakdowns transparently
3. Enable easy correction of mistakes
4. Maintain mobile responsiveness

### **Security Rules**
1. Implement role-based access to project data
2. Validate all input data server-side
3. Protect against SQL injection in dynamic queries
4. Encrypt sensitive business data

---

## 🎯 Success Metrics

### **Phase 1 Success Criteria**
- Database schema successfully implemented
- All existing functionality preserved
- Advanced calculation engine operational
- API endpoints responding correctly

### **Phase 2 Success Criteria**
- Material assignment workflow functional
- Real-time calculations working
- Project creation with building specs
- Phase-based material organization

### **Phase 3 Success Criteria**
- BOQ import system operational
- Dashboard showing advanced analytics
- Reporting suite generating accurate reports
- User experience significantly improved

### **Phase 4 Success Criteria**
- Performance benchmarks met (<2s load times)
- 95%+ test coverage achieved
- Documentation complete
- Production deployment ready

---

## 🔄 Development Workflow

### **Implementation Order**
1. **Database Schema**: Implement enhanced database structure
2. **TypeScript Types**: Update shared schema definitions
3. **API Endpoints**: Build backend functionality
4. **UI Components**: Create frontend interfaces
5. **Calculation Engine**: Implement advanced calculations
6. **Testing**: Comprehensive testing suite
7. **Documentation**: Complete user and developer guides

### **Quality Assurance**
- Code reviews for all changes
- Testing at each implementation step
- Performance monitoring
- User feedback integration

---

## 🧠 AI Agent Implementation Rules

### **Critical Development Standards from DEVELOPMENT_STANDARDS.md**

#### **Code Quality Requirements**
- ✅ Enterprise-grade code quality - no playground shortcuts
- ✅ Modular architecture with controller-service-repository pattern
- ✅ TypeScript interfaces for all data structures
- ✅ Functions must have clear names, input/output types, JSDoc comments
- ✅ Files should be < 250 LOC, split complex logic into utils/hooks/services
- ❌ No inline logic in React pages/components
- ❌ No console.log statements in production code

#### **Mobile Responsiveness Requirements**
- ✅ All components must be responsive by default
- ✅ Use Tailwind mobile-first breakpoints (sm, md, lg, xl)
- ✅ Touch-friendly interface elements (minimum 44px touch targets)
- ✅ Test on mobile, tablet, and desktop viewports

#### **Security Standards**
- ✅ Sanitize all inputs at client and server level
- ✅ Use role-based access control (admin, estimator, viewer)
- ✅ Parameterized queries to prevent SQL injection
- ✅ Validate authentication tokens on all sensitive routes
- ❌ Never expose API keys or tokens to client

#### **Database Standards**
- ✅ All tables must have UUID primary keys, created_at, updated_at columns
- ✅ Use proper constraints, validations, and indexing
- ✅ All emission calculations must be auditable
- ✅ Use decimal types for precise emission calculations
- ✅ Implement soft deletes where appropriate

#### **API Standards**
- ✅ RESTful conventions with proper HTTP status codes
- ✅ Consistent error format with success/message/code/field structure
- ✅ Validate all request payloads (types, structure, auth)
- ✅ Emission calculations must return detailed breakdowns
- ✅ Include calculation metadata in responses

#### **Performance Standards**
- ✅ Page load times < 2 seconds
- ✅ API response times < 500ms
- ✅ Use React Query for efficient caching
- ✅ Implement lazy loading for large components
- ✅ Optimize database queries with proper indexing

#### **SaHa Domain-Specific Standards**
- ✅ Use scientifically accurate emission factors
- ✅ Validate against industry standards (ICE Database, EPA guidelines)
- ✅ Handle regional variations in emission factors
- ✅ Account for material transportation distances and waste factors
- ✅ Support standard construction phases and BOQ formats

#### **Testing Requirements**
- ✅ Unit tests for all business logic functions
- ✅ Integration tests for API endpoints
- ✅ Component tests for React components
- ✅ Test emission calculation accuracy
- ✅ Maintain >80% code coverage

#### **AI Agent Decision Framework**
1. **Analyze**: Review existing code patterns and architecture
2. **Plan**: Consider multiple implementation approaches
3. **Validate**: Ensure solution aligns with project goals
4. **Implement**: Write clean, maintainable code
5. **Test**: Suggest testing approach and edge cases
6. **Document**: Explain changes and rationale

### **Implementation Validation Checklist**
- [ ] Code follows SaHa style guidelines
- [ ] All functions have proper TypeScript types
- [ ] Error handling is implemented
- [ ] Mobile responsiveness verified
- [ ] Security implications assessed
- [ ] Performance considerations reviewed
- [ ] Domain-specific calculations are accurate
- [ ] Database design follows standards
- [ ] API endpoints follow RESTful conventions

## 📝 Notes

- This guide incorporates all DEVELOPMENT_STANDARDS.md requirements
- All implementation must follow enterprise-grade development practices
- Regular reviews to ensure alignment with SaHa domain expertise
- Updates required for any deviations from established standards

---

**Last Updated**: January 2025 (Updated with DEVELOPMENT_STANDARDS.md integration)
**Next Review**: After Phase 1 completion