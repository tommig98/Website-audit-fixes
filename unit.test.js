// ==================================
// UNIT TESTS - Jest Configuration
// ==================================

const {
  AppState,
  ApiClient,
  StubEndpoints,
  validateForm,
  showModal,
  closeModal
} = require('../website-improvements.js');

// Mock DOM environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.localStorage = {
  data: {},
  setItem(key, value) { this.data[key] = value; },
  getItem(key) { return this.data[key] || null; },
  removeItem(key) { delete this.data[key]; }
};

describe('AppState', () => {
  let appState;

  beforeEach(() => {
    appState = new AppState();
    localStorage.data = {}; // Reset localStorage
  });

  test('should initialize with empty state', () => {
    expect(appState.user).toBeNull();
    expect(appState.isLoading).toBe(false);
    expect(appState.errors).toEqual([]);
  });

  test('should set and get user', () => {
    const user = { id: 1, name: 'Test User' };
    appState.setUser(user);

    expect(appState.getUser()).toEqual(user);
    expect(localStorage.getItem('user')).toBe(JSON.stringify(user));
  });

  test('should retrieve user from localStorage', () => {
    const user = { id: 2, name: 'Stored User' };
    localStorage.setItem('user', JSON.stringify(user));

    const newAppState = new AppState();
    expect(newAppState.getUser()).toEqual(user);
  });
});

describe('ApiClient', () => {
  let apiClient;

  beforeEach(() => {
    apiClient = new ApiClient('/test-api');
    // Mock fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should make GET request', async () => {
    const mockResponse = { data: 'test' };
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await apiClient.get('/endpoint');

    expect(fetch).toHaveBeenCalledWith('/test-api/endpoint', {
      headers: { 'Content-Type': 'application/json' }
    });
    expect(result).toEqual(mockResponse);
  });

  test('should make POST request with data', async () => {
    const mockResponse = { success: true };
    const postData = { name: 'Test' };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await apiClient.post('/endpoint', postData);

    expect(fetch).toHaveBeenCalledWith('/test-api/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData)
    });
    expect(result).toEqual(mockResponse);
  });

  test('should retry on failure', async () => {
    fetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

    const result = await apiClient.get('/endpoint');

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ success: true });
  });
});

describe('StubEndpoints', () => {
  test('should generate program', async () => {
    const userProfile = {
      age: 25,
      weight: 70,
      goal: 'muscle_gain'
    };

    const result = await StubEndpoints.generateProgram(userProfile);

    expect(result.success).toBe(true);
    expect(result.program).toHaveProperty('id');
    expect(result.program).toHaveProperty('name');
    expect(result.program.workouts).toHaveLength(3);
    expect(result.program.nutrition).toHaveProperty('calories');
  });

  test('should validate form data', async () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com'
    };

    const result = await StubEndpoints.checkForm(validData);

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  test('should find form validation errors', async () => {
    const invalidData = {
      name: 'A',
      email: 'invalid-email'
    };

    const result = await StubEndpoints.checkForm(invalidData);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Nome deve essere almeno 2 caratteri');
    expect(result.issues).toContain('Email non valida');
  });

  test('should authenticate user with valid credentials', async () => {
    const credentials = {
      email: 'test@example.com',
      password: 'password123'
    };

    const result = await StubEndpoints.authenticateUser(credentials);

    expect(result.success).toBe(true);
    expect(result.user.email).toBe(credentials.email);
    expect(result.token).toMatch(/^demo_token_/);
  });
});

describe('Form Validation', () => {
  let form, input1, input2;

  beforeEach(() => {
    form = document.createElement('form');

    input1 = document.createElement('input');
    input1.type = 'email';
    input1.name = 'email';
    input1.required = true;

    input2 = document.createElement('input');
    input2.type = 'text';
    input2.name = 'name';
    input2.required = true;

    form.appendChild(input1);
    form.appendChild(input2);
  });

  test('should validate required fields', () => {
    input1.value = '';
    input2.value = '';

    const errors = validateForm(form);

    expect(errors).toContain('Il campo email è obbligatorio');
    expect(errors).toContain('Il campo name è obbligatorio');
  });

  test('should validate email format', () => {
    input1.value = 'invalid-email';
    input2.value = 'Valid Name';

    const errors = validateForm(form);

    expect(errors).toContain('Email non valida nel campo email');
    expect(errors).not.toContain('Il campo name è obbligatorio');
  });

  test('should pass with valid data', () => {
    input1.value = 'test@example.com';
    input2.value = 'Valid Name';

    const errors = validateForm(form);

    expect(errors).toHaveLength(0);
  });
});

describe('Modal Functions', () => {
  test('should create modal with content', () => {
    showModal('Test Title', 'Test Content');

    const modal = document.querySelector('.modal');
    expect(modal).toBeTruthy();
    expect(modal.innerHTML).toContain('Test Title');
    expect(modal.innerHTML).toContain('Test Content');
  });

  test('should close modal', () => {
    showModal('Test', 'Content');

    let modal = document.querySelector('.modal');
    expect(modal).toBeTruthy();

    closeModal();

    // Modal should be hidden
    modal = document.querySelector('.modal');
    if (modal) {
      expect(modal.style.display).toBe('none');
    }
  });

  test('should remove existing modal before creating new one', () => {
    showModal('First', 'Content 1');
    showModal('Second', 'Content 2');

    const modals = document.querySelectorAll('.modal');
    expect(modals).toHaveLength(1);
    expect(modals[0].innerHTML).toContain('Second');
  });
});

// Integration test helpers
describe('Integration Tests', () => {
  test('should handle complete user registration flow', async () => {
    const appState = new AppState();

    // Simulate user registration
    const credentials = {
      email: 'newuser@example.com',
      password: 'securepass',
      name: 'New User'
    };

    const authResult = await StubEndpoints.authenticateUser(credentials);
    expect(authResult.success).toBe(true);

    // Set user in app state
    appState.setUser(authResult.user);

    const user = appState.getUser();
    expect(user.email).toBe(credentials.email);
    expect(user.subscription).toBe('trial');
  });

  test('should handle program generation with user profile', async () => {
    const userProfile = {
      age: 30,
      weight: 75,
      height: 180,
      goal: 'weight_loss',
      experience: 'beginner'
    };

    const result = await StubEndpoints.generateProgram(userProfile);

    expect(result.success).toBe(true);
    expect(result.program.workouts.length).toBeGreaterThan(0);
    expect(result.program.nutrition.calories).toBeGreaterThan(0);
  });
});
