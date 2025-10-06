// ==================================
// WEBSITE FUNCTIONAL IMPROVEMENTS
// ==================================

/**
 * Gestione stato applicazione
 */
class AppState {
  constructor() {
    this.user = null;
    this.isLoading = false;
    this.errors = [];
  }

  setUser(user) {
    this.user = user;
    localStorage.setItem('user', JSON.stringify(user));
  }

  getUser() {
    if (!this.user) {
      const stored = localStorage.getItem('user');
      this.user = stored ? JSON.parse(stored) : null;
    }
    return this.user;
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.updateLoadingUI();
  }

  updateLoadingUI() {
    const loadingElements = document.querySelectorAll('.loading-indicator');
    loadingElements.forEach(el => {
      el.style.display = this.isLoading ? 'block' : 'none';
    });
  }
}

const appState = new AppState();

/**
 * Gestione API e fetch con retry
 */
class ApiClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
    this.retries = 3;
    this.timeout = 10000;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    for (let i = 0; i < this.retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...config,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        if (i === this.retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  async get(endpoint) {
    return this.request(endpoint);
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}

const api = new ApiClient();

/**
 * Stub endpoints per demo
 */
class StubEndpoints {
  static async generateProgram(userProfile) {
    // Simula chiamata API con loading
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
      success: true,
      program: {
        id: Date.now(),
        name: "Programma Personalizzato",
        duration: "12 settimane",
        workouts: [
          {
            day: "Lunedì",
            exercises: ["Push-up", "Squat", "Plank"],
            duration: "45 min"
          },
          {
            day: "Mercoledì", 
            exercises: ["Deadlift", "Pull-up", "Burpees"],
            duration: "50 min"
          },
          {
            day: "Venerdì",
            exercises: ["Bench Press", "Leg Press", "Abs"],
            duration: "45 min"
          }
        ],
        nutrition: {
          calories: 2200,
          protein: "140g",
          carbs: "220g",
          fat: "80g"
        }
      }
    };
  }

  static async checkForm(formData) {
    await new Promise(resolve => setTimeout(resolve, 1500));

    const issues = [];
    if (!formData.name || formData.name.length < 2) {
      issues.push("Nome deve essere almeno 2 caratteri");
    }
    if (!formData.email || !formData.email.includes('@')) {
      issues.push("Email non valida");
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions: issues.length === 0 ? ["Ottimo! Tutti i campi sono corretti"] : []
    };
  }

  static async authenticateUser(credentials) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Demo: accetta qualsiasi email/password non vuoti
    if (credentials.email && credentials.password) {
      return {
        success: true,
        user: {
          id: 123,
          email: credentials.email,
          name: credentials.name || "Utente Demo",
          subscription: "trial",
          trialDays: 14
        },
        token: "demo_token_" + Date.now()
      };
    }

    return {
      success: false,
      error: "Credenziali non valide"
    };
  }
}

/**
 * Funzioni UI principali
 */
function showModal(title, content, actions = []) {
  // Rimuovi modal esistenti
  const existing = document.querySelector('.modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="modal-close" onclick="closeModal()">&times;</span>
      <h3>${title}</h3>
      <div class="modal-body">${content}</div>
      <div class="modal-actions">
        ${actions.map(action => 
          `<button class="btn ${action.class || 'btn-secondary'}" onclick="${action.onclick}">${action.text}</button>`
        ).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.style.display = 'block';

  // Focus management per accessibilità
  modal.querySelector('.modal-close').focus();

  return modal;
}

function closeModal() {
  const modal = document.querySelector('.modal');
  if (modal) {
    modal.style.display = 'none';
    setTimeout(() => modal.remove(), 300);
  }
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()">&times;</button>
  `;

  document.body.appendChild(notification);

  // Auto remove dopo 5 secondi
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

/**
 * Handlers per i bottoni principali
 */
async function generateProgram() {
  try {
    appState.setLoading(true);
    showNotification("Generazione programma in corso...", "info");

    // Raccoglie dati utente (stub)
    const userProfile = {
      age: 30,
      weight: 70,
      height: 175,
      goal: "muscle_gain",
      experience: "intermediate"
    };

    const result = await StubEndpoints.generateProgram(userProfile);

    if (result.success) {
      displayProgram(result.program);
      showNotification("Programma generato con successo!", "success");
    }
  } catch (error) {
    console.error("Error generating program:", error);
    showNotification("Errore nella generazione. Riprova.", "error");
  } finally {
    appState.setLoading(false);
  }
}

function displayProgram(program) {
  const content = `
    <h4>${program.name}</h4>
    <p><strong>Durata:</strong> ${program.duration}</p>

    <h5>Piano Allenamento:</h5>
    <ul>
      ${program.workouts.map(workout => `
        <li><strong>${workout.day}:</strong> ${workout.exercises.join(', ')} (${workout.duration})</li>
      `).join('')}
    </ul>

    <h5>Piano Nutrizionale:</h5>
    <p><strong>Calorie giornaliere:</strong> ${program.nutrition.calories}</p>
    <p><strong>Macros:</strong> Proteine ${program.nutrition.protein}, Carboidrati ${program.nutrition.carbs}, Grassi ${program.nutrition.fat}</p>
  `;

  showModal("Il Tuo Programma Personalizzato", content, [
    { text: "Scarica PDF", onclick: "downloadProgramPDF()", class: "btn-primary" },
    { text: "Chiudi", onclick: "closeModal()", class: "btn-secondary" }
  ]);
}

async function checkFormAI() {
  const form = document.querySelector('#user-form');
  if (!form) {
    showNotification("Form non trovato", "error");
    return;
  }

  try {
    appState.setLoading(true);

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    const result = await StubEndpoints.checkForm(data);

    const content = `
      <h4>Risultato Controllo Form</h4>
      ${result.valid ? 
        '<p class="success-message">✅ Tutti i campi sono corretti!</p>' :
        `<div class="error-message">
          <p>⚠️ Problemi trovati:</p>
          <ul>${result.issues.map(issue => `<li>${issue}</li>`).join('')}</ul>
        </div>`
      }
      ${result.suggestions.length > 0 ? 
        `<div class="success-message">
          <p>💡 Suggerimenti:</p>
          <ul>${result.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>
        </div>` : ''
      }
    `;

    showModal("Controllo Form AI", content);
  } catch (error) {
    console.error("Error checking form:", error);
    showNotification("Errore nel controllo form", "error");
  } finally {
    appState.setLoading(false);
  }
}

async function startTrial() {
  try {
    // Simula processo di registrazione
    const email = prompt("Inserisci la tua email per iniziare la prova gratuita:");
    if (!email) return;

    appState.setLoading(true);
    showNotification("Attivazione prova gratuita...", "info");

    const result = await StubEndpoints.authenticateUser({
      email,
      password: "demo", // In produzione: form di registrazione completo
      name: "Nuovo Utente"
    });

    if (result.success) {
      appState.setUser(result.user);
      showNotification(`Benvenuto ${result.user.name}! Prova gratuita attivata.`, "success");

      // Redirect a dashboard (stub)
      setTimeout(() => {
        window.location.hash = "#dashboard";
        updateUserInterface();
      }, 2000);
    } else {
      showNotification(result.error, "error");
    }
  } catch (error) {
    console.error("Error starting trial:", error);
    showNotification("Errore nell'attivazione. Riprova.", "error");
  } finally {
    appState.setLoading(false);
  }
}

function downloadProgramPDF() {
  // Stub: in produzione genererebbe PDF reale
  const link = document.createElement('a');
  link.href = '#';
  link.download = 'programma-personalizzato.pdf';

  showNotification("Download PDF non ancora implementato. Verrà aggiunto nelle prossime versioni.", "info");
  closeModal();
}

/**
 * Smooth scrolling per navigation
 */
function scrollToSection(sectionId) {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  }
}

/**
 * Form validation avanzata
 */
function validateForm(form) {
  const errors = [];
  const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');

  inputs.forEach(input => {
    const value = input.value.trim();
    const type = input.type;
    const name = input.name || input.id;

    if (!value) {
      errors.push(`Il campo ${name} è obbligatorio`);
      input.classList.add('error');
    } else {
      input.classList.remove('error');

      // Validazioni specifiche per tipo
      switch(type) {
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`Email non valida nel campo ${name}`);
            input.classList.add('error');
          }
          break;
        case 'tel':
          if (!/^[\d\s\+\-\(\)]+$/.test(value)) {
            errors.push(`Numero di telefono non valido nel campo ${name}`);
            input.classList.add('error');
          }
          break;
      }
    }
  });

  return errors;
}

/**
 * Gestione lazy loading immagini
 */
function setupLazyLoading() {
  const images = document.querySelectorAll('img[data-src]');

  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          imageObserver.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  } else {
    // Fallback per browser senza IntersectionObserver
    images.forEach(img => {
      img.src = img.dataset.src;
    });
  }
}

/**
 * Gestione cookie consent (GDPR)
 */
function showCookieConsent() {
  if (localStorage.getItem('cookieConsent')) return;

  const banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.innerHTML = `
    <div class="cookie-content">
      <p>Questo sito utilizza cookie per migliorare l'esperienza utente. 
      <a href="/privacy-policy" target="_blank">Leggi di più</a></p>
      <button onclick="acceptCookies()" class="btn btn-primary btn-sm">Accetta</button>
      <button onclick="dismissCookies()" class="btn btn-secondary btn-sm">Rifiuta</button>
    </div>
  `;

  document.body.appendChild(banner);
}

function acceptCookies() {
  localStorage.setItem('cookieConsent', 'accepted');
  document.querySelector('.cookie-banner').remove();
}

function dismissCookies() {
  localStorage.setItem('cookieConsent', 'dismissed');
  document.querySelector('.cookie-banner').remove();
}

/**
 * Aggiornamento interfaccia per utente loggato
 */
function updateUserInterface() {
  const user = appState.getUser();
  const loginButtons = document.querySelectorAll('.login-btn');
  const userMenus = document.querySelectorAll('.user-menu');

  if (user) {
    loginButtons.forEach(btn => btn.style.display = 'none');
    userMenus.forEach(menu => {
      menu.style.display = 'block';
      menu.innerHTML = `
        <span>Ciao, ${user.name}!</span>
        <button onclick="logout()" class="btn btn-sm">Logout</button>
      `;
    });
  }
}

function logout() {
  localStorage.removeItem('user');
  appState.user = null;
  showNotification("Logout effettuato", "info");
  updateUserInterface();
}

/**
 * Inizializzazione al caricamento pagina
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('Website functional improvements loaded');

  // Setup lazy loading
  setupLazyLoading();

  // Show cookie consent
  showCookieConsent();

  // Update UI based on user state
  updateUserInterface();

  // Setup form validation
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      const errors = validateForm(form);
      if (errors.length > 0) {
        e.preventDefault();
        showNotification(errors[0], "error");
      }
    });
  });

  // Setup keyboard navigation
  document.addEventListener('keydown', function(e) {
    // ESC per chiudere modal
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // Handle hash navigation
  window.addEventListener('hashchange', function() {
    const hash = window.location.hash.substring(1);
    if (hash) {
      scrollToSection(hash);
    }
  });

  // Performance monitoring
  if ('performance' in window) {
    window.addEventListener('load', function() {
      const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
      if (loadTime > 3000) {
        console.warn(`Slow page load detected: ${loadTime}ms`);
      }
    });
  }
});

/**
 * Service Worker registration per PWA
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('SW registered: ', registration);
      })
      .catch(function(registrationError) {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Export per testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AppState,
    ApiClient,
    StubEndpoints,
    validateForm,
    showModal,
    closeModal
  };
}
