

// app.js
document.addEventListener('DOMContentLoaded', function() {
  // =====================
  // Initialize Dictionary App
  // =====================
  class GermanDictionary {
    constructor() {
      this.dbName = 'GermanPersianDictionary';
      this.dbVersion = 2;
      this.db = null;
      this.currentWord = null;
      this.favorites = new Set();
      this.init();
      window.addEventListener('resize', () => {
  this.handleResponsive();
});
      
    }
    
    handleResponsive() {
  const sidebar = document.querySelector('.sidebar');
  const menuItems = document.querySelectorAll('.menu-item');
  
  if (window.innerWidth < 1200) {
    // حالت موبایل و تبلت
    if (sidebar) {
      sidebar.style.flexDirection = 'row';
      sidebar.style.flexWrap = 'wrap';
      sidebar.style.justifyContent = 'center';
    }
    
    menuItems.forEach(item => {
      item.style.margin = '2px';
    });
  } else {
    // حالت دسکتاپ
    if (sidebar) {
      sidebar.style.flexDirection = 'column';
      sidebar.style.flexWrap = 'nowrap';
    }
    
    menuItems.forEach(item => {
      item.style.margin = '';
    });
  }
}
    // =====================
    // Database Initialization
    // =====================
    async init() {
      
      await this.initDB();
      await this.loadFavorites();
      this.setupEventListeners();
      this.renderWordList();
      this.updateStats();
      
      // Enable service worker for PWA
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('Service Worker registered', reg))
          .catch(err => console.log('Service Worker registration failed', err));
      }
    }
    
    initDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.dbVersion);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          if (!db.objectStoreNames.contains('words')) {
            const store = db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
            store.createIndex('german', 'german', { unique: true });
            store.createIndex('gender', 'gender', { unique: false });
            store.createIndex('type', 'type', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
          
          if (!db.objectStoreNames.contains('favorites')) {
            db.createObjectStore('favorites', { keyPath: 'wordId' });
          }
          
          if (!db.objectStoreNames.contains('examples')) {
            const exStore = db.createObjectStore('examples', { keyPath: 'id', autoIncrement: true });
            exStore.createIndex('wordId', 'wordId', { unique: false });
          }
          
          if (!db.objectStoreNames.contains('practiceHistory')) {
            const phStore = db.createObjectStore('practiceHistory', { keyPath: 'id', autoIncrement: true });
            phStore.createIndex('wordId', 'wordId', { unique: false });
            phStore.createIndex('date', 'date', { unique: false });
          }
        };
        
        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve();
        };
        
        request.onerror = (event) => {
          console.error('Database error:', event.target.error);
          reject(event.target.error);
        };
      });
      
    }
    showToast(message, type = 'info') {
  // ابتدا toast قبلی را حذف کنیم اگر وجود دارد
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                     type === 'error' ? 'fa-times-circle' : 
                     type === 'warning' ? 'fa-exclamation-circle' :
                     'fa-info-circle'}"></i>
    <span>${message}</span>
    <i class="fas fa-times toast-close"></i>
  `;
  
  document.body.appendChild(toast);
  
  // محاسبه موقعیت برای عدم تداخل با منو
  const sidebar = document.querySelector('.sidebar');
  const sidebarWidth = sidebar ? sidebar.offsetWidth : 0;
  toast.style.left = `calc(50% + ${sidebarWidth / 2}px)`;
  
  // برای ریسپانسیو بودن موقعیت
  const updateToastPosition = () => {
    if (window.innerWidth < 992) {
      toast.style.left = '50%';
    } else {
      toast.style.left = `calc(50% + ${sidebarWidth / 2}px)`;
    }
  };
  
  window.addEventListener('resize', updateToastPosition);
  updateToastPosition();

  // Auto remove after 5 seconds
  const removeToast = () => {
    toast.style.animation = 'fadeOut 0.3s ease-in-out';
    setTimeout(() => {
      toast.remove();
      window.removeEventListener('resize', updateToastPosition);
    }, 300);
  };
  
  setTimeout(removeToast, 5000);
  
  // Close button
  toast.querySelector('.toast-close').addEventListener('click', removeToast);
  
  // اضافه کردن انیمیشن fadeOut
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes fadeOut {
      from { opacity: 1; top: ${toast.style.top}; }
      to { opacity: 0; top: 0; }
    }
  `;
  document.head.appendChild(style);
}
    // =====================
    // Word CRUD Operations
    // =====================
    async addWord(wordData) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['words'], 'readwrite');
        const store = transaction.objectStore('words');
        
        // Add createdAt timestamp
        wordData.createdAt = new Date().toISOString();
        
        const request = store.add(wordData);
        
        request.onsuccess = () => {
          this.showToast('لغت با موفقیت اضافه شد', 'success');
          this.renderWordList();
          this.updateStats();
          resolve(request.result);
        };
        
        request.onerror = (event) => {
          this.showToast('خطا در اضافه کردن لغت', 'error');
          reject(event.target.error);
        };
      });
    }

    async getWord(id) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['words'], 'readonly');
        const store = transaction.objectStore('words');
        const request = store.get(id);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
      });
    }

    async searchWords(query) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['words'], 'readonly');
        const store = transaction.objectStore('words');
        const request = store.getAll();
        
        request.onsuccess = () => {
          const words = request.result.filter(word => 
            word.german.toLowerCase().startsWith(query.toLowerCase()) || 
            word.persian.toLowerCase().includes(query.toLowerCase())
          );
          resolve(words);
        };
        
        request.onerror = (event) => reject(event.target.error);
      });
    }

    async getAllWords() {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['words'], 'readonly');
        const store = transaction.objectStore('words');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
      });
    }

    async deleteWord(id) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['words'], 'readwrite');
        const store = transaction.objectStore('words');
        const request = store.delete(id);
        
        request.onsuccess = () => {
          this.showToast('لغت با موفقیت حذف شد', 'success');
          this.renderWordList();
          this.updateStats();
          resolve();
        };
        
        request.onerror = (event) => {
          this.showToast('خطا در حذف لغت', 'error');
          reject(event.target.error);
        };
      });
    }

    // =====================
    // Favorites Management
    // =====================
    async loadFavorites() {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['favorites'], 'readonly');
        const store = transaction.objectStore('favorites');
        const request = store.getAll();
        
        request.onsuccess = () => {
          this.favorites = new Set(request.result.map(item => item.wordId));
          resolve();
        };
        
        request.onerror = (event) => reject(event.target.error);
      });
    }

    async toggleFavorite(wordId) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['favorites'], 'readwrite');
        const store = transaction.objectStore('favorites');
        
        if (this.favorites.has(wordId)) {
          const request = store.delete(wordId);
          
          request.onsuccess = () => {
            this.favorites.delete(wordId);
            this.showToast('از علاقه‌مندی‌ها حذف شد', 'info');
            resolve(false);
          };
          
          request.onerror = (event) => reject(event.target.error);
        } else {
          const request = store.add({ wordId });
          
          request.onsuccess = () => {
            this.favorites.add(wordId);
            this.showToast('به علاقه‌مندی‌ها اضافه شد', 'success');
            resolve(true);
          };
          
          request.onerror = (event) => reject(event.target.error);
        }
      });
    }

    // =====================
    // Examples Management
    // =====================
    async addExample(wordId, exampleData) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['examples'], 'readwrite');
        const store = transaction.objectStore('examples');
        
        exampleData.wordId = wordId;
        exampleData.createdAt = new Date().toISOString();
        
        const request = store.add(exampleData);
        
        request.onsuccess = () => {
          this.showToast('مثال با موفقیت اضافه شد', 'success');
          if (this.currentWord && this.currentWord.id === wordId) {
            this.renderWordDetails(this.currentWord);
          }
          resolve(request.result);
        };
        
        request.onerror = (event) => {
          this.showToast('خطا در اضافه کردن مثال', 'error');
          reject(event.target.error);
        };
      });
    }

    async getExamplesForWord(wordId) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['examples'], 'readonly');
        const store = transaction.objectStore('examples');
        const index = store.index('wordId');
        const request = index.getAll(wordId);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
      });
    }

    // =====================
    // Practice System
    // =====================
    async recordPractice(wordId, correct) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['practiceHistory'], 'readwrite');
        const store = transaction.objectStore('practiceHistory');
        
        const record = {
          wordId,
          correct,
          date: new Date().toISOString()
        };
        
        const request = store.add(record);
        
        request.onsuccess = () => {
          this.updateStats();
          resolve();
        };
        
        request.onerror = (event) => reject(event.target.error);
      });
    }
    async saveWord() {
  const german = document.getElementById('german-word').value;
  const persian = document.getElementById('persian-meaning').value;
  const gender = document.querySelector('.gender-btn.active')?.getAttribute('data-gender') || null;
  const type = document.getElementById('word-type').value;
  
  if (!german || !persian) {
    this.showToast('لطفاً هر دو فیلد لغت و معنی را پر کنید', 'error');
    return;
  }
  
  const wordData = {
    german,
    persian,
    gender,
    type
  };
  
  if (type === 'verb') {
    const present = document.getElementById('verb-present')?.value.trim() || '';
    const past = document.getElementById('verb-past')?.value.trim() || '';
    const perfect = document.getElementById('verb-perfect')?.value.trim() || '';
    
    if (present || past || perfect) {
      wordData.verbForms = { present, past, perfect };
    }
  }
  
  await this.addWord(wordData);
  
  // Clear form
  document.getElementById('german-word').value = '';
  document.getElementById('persian-meaning').value = '';
  document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  document.getElementById('verb-present').value = '';
  document.getElementById('verb-past').value = '';
  document.getElementById('verb-perfect').value = '';
  
  // Focus back to first field
  document.getElementById('german-word').focus();
}
    async getPracticeHistory(wordId) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['practiceHistory'], 'readonly');
        const store = transaction.objectStore('practiceHistory');
        const index = store.index('wordId');
        const request = index.getAll(wordId);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
      });
    }

    // =====================
    // UI Rendering
    // =====================
    async renderWordList(filter = 'all') {
      const words = await this.getAllWords();
      const wordListContainer = document.getElementById('word-list-section');
      
      if (!wordListContainer) return;
      
      let filteredWords = words;
      
      if (filter === 'favorites') {
        filteredWords = words.filter(word => this.favorites.has(word.id));
      } else if (filter === 'nouns') {
        filteredWords = words.filter(word => word.type === 'noun');
      } else if (filter === 'verbs') {
        filteredWords = words.filter(word => word.type === 'verb');
      }
      
      wordListContainer.innerHTML = `
        <h2>لیست لغات (${filteredWords.length})</h2>
        <div class="filter-buttons mb-3">
          <button class="btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}" data-filter="all">همه</button>
          <button class="btn btn-sm ${filter === 'favorites' ? 'btn-primary' : 'btn-outline'}" data-filter="favorites">علاقه‌مندی‌ها</button>
          <button class="btn btn-sm ${filter === 'nouns' ? 'btn-primary' : 'btn-outline'}" data-filter="nouns">اسم‌ها</button>
          <button class="btn btn-sm ${filter === 'verbs' ? 'btn-primary' : 'btn-outline'}" data-filter="verbs">فعل‌ها</button>
        </div>
        <div class="word-list">
          ${filteredWords.map(word => `
            <div class="word-list-item" data-id="${word.id}">
              <div class="word-list-item-header">
                <div>
                  <span class="word-list-item-title">${word.german}</span>
                  ${word.gender ? `<span class="word-gender ${word.gender}">${this.getGenderSymbol(word.gender)}</span>` : ''}
                  ${word.type ? `<span class="word-type">${this.getTypeLabel(word.type)}</span>` : ''}
                </div>
                <i class="fas fa-star favorite-icon ${this.favorites.has(word.id) ? 'active' : ''}" data-id="${word.id}"></i>
              </div>
              <div class="word-list-item-meaning">${word.persian}</div>
              <div class="word-list-item-actions">
                <button class="btn btn-sm btn-outline view-word" data-id="${word.id}">مشاهده</button>
                <button class="btn btn-sm btn-outline practice-word" data-id="${word.id}">تمرین</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      
      // Add event listeners to the rendered elements
      document.querySelectorAll('.favorite-icon').forEach(icon => {
        icon.addEventListener('click', async (e) => {
          e.stopPropagation();
          const wordId = parseInt(icon.getAttribute('data-id'));
          await this.toggleFavorite(wordId);
          icon.classList.toggle('active');
        });
      });
      
      document.querySelectorAll('.view-word').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const wordId = parseInt(btn.getAttribute('data-id'));
          const word = await this.getWord(wordId);
          this.renderWordDetails(word);
          this.showSection('search-section');
        });
      });
      
      document.querySelectorAll('.practice-word').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const wordId = parseInt(btn.getAttribute('data-id'));
          this.startPracticeSession([wordId]);
        });
      });
      
      document.querySelectorAll('.filter-buttons button').forEach(btn => {
        btn.addEventListener('click', () => {
          const filter = btn.getAttribute('data-filter');
          this.renderWordList(filter);
        });
      });
    }
    async renderSearchResults(query) {
    const results = await this.searchWords(query);
    
    if (results.length === 0) {
        this.showToast('هیچ نتیجه‌ای یافت نشد', 'info');
        return;
    }

    document.getElementById('search-section').innerHTML = `
        <div class="search-box">
            <input type="text" id="search-input" placeholder="لغت آلمانی یا فارسی را جستجو کنید..." value="${query}">
            <button id="search-btn"><i class="fas fa-search"></i></button>
        </div>
        
        <h3>نتایج جستجو برای "${query}" (${results.length} مورد)</h3>
        
        <div class="word-list">
            ${results.map(word => `
                <div class="word-list-item" data-id="${word.id}">
                    <div class="word-list-item-header">
                        <div>
                            <span class="word-list-item-title">${word.german}</span>
                            ${word.gender ? `<span class="word-gender ${word.gender}">${this.getGenderSymbol(word.gender)}</span>` : ''}
                            ${word.type ? `<span class="word-type">${this.getTypeLabel(word.type)}</span>` : ''}
                        </div>
                        <i class="fas fa-star favorite-icon ${this.favorites.has(word.id) ? 'active' : ''}" data-id="${word.id}"></i>
                    </div>
                    <div class="word-list-item-meaning">${word.persian}</div>
                    <div class="word-list-item-actions">
                        <button class="btn btn-sm btn-outline view-word" data-id="${word.id}">مشاهده جزئیات</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // Add event listeners
    document.querySelectorAll('.view-word').forEach(btn => {
        btn.addEventListener('click', async () => {
            const wordId = parseInt(btn.getAttribute('data-id'));
            const word = await this.getWord(wordId);
            this.renderWordDetails(word);
        });
    });

    document.querySelectorAll('.favorite-icon').forEach(icon => {
        icon.addEventListener('click', async (e) => {
            e.stopPropagation();
            const wordId = parseInt(icon.getAttribute('data-id'));
            await this.toggleFavorite(wordId);
            icon.classList.toggle('active');
        });
    });

    this.setupSearchEventListeners();
}
    async renderWordDetails(word) {
      this.currentWord = word;
      const examples = await this.getExamplesForWord(word.id);
      const practiceHistory = await this.getPracticeHistory(word.id);
      
      const successRate = practiceHistory.length > 0 
        ? Math.round((practiceHistory.filter(h => h.correct).length / practiceHistory.length)) * 100 
        : 0;
      
      document.getElementById('search-section').innerHTML = `
        <div class="search-box">
          <input type="text" id="search-input" placeholder="لغت آلمانی یا فارسی را جستجو کنید...">
          <button id="search-btn"><i class="fas fa-search"></i></button>
        </div>
        <div class="word-card">
          <div class="word-header">
            <div>
              <span class="word-title">${word.german}</span>
              ${word.gender ? `<span class="word-gender ${word.gender}">${this.getGenderLabel(word.gender)}</span>` : ''}
              ${word.type ? `<span class="word-type">${this.getTypeLabel(word.type)}</span>` : ''}
              ${word.verbForms ? `<span class="word-type">صرف فعل</span>` : ''}
            </div>
            <div class="word-actions">
              <i class="fas fa-star favorite-icon ${this.favorites.has(word.id) ? 'active' : ''}" data-id="${word.id}"></i>
              <i class="fas fa-volume-up pronunciation-icon" data-word="${word.german}"></i>
            </div>
          </div>
          <div class="word-meaning">
            <p><strong>معنی:</strong> ${word.persian}</p>
          </div>
          
          ${word.verbForms ? `
            <div class="verb-forms">
              <div class="verb-form-row">
                <div>
                  <div class="verb-form-label">حال ساده</div>
                  <input type="text" class="form-control" value="${word.verbForms.present || ''}" readonly>
                </div>
                <div>
                  <div class="verb-form-label">گذشته</div>
                  <input type="text" class="form-control" value="${word.verbForms.past || ''}" readonly>
                </div>
                <div>
                  <div class="verb-form-label">گذشته کامل</div>
                  <input type="text" class="form-control" value="${word.verbForms.perfect || ''}" readonly>
                </div>
              </div>
            </div>
          ` : ''}
          
          <div class="tab-container">
            <div class="tab active" data-tab="examples">مثال‌ها (${examples.length})</div>
            <div class="tab" data-tab="practice">تمرین (${practiceHistory.length})</div>
            <div class="tab" data-tab="stats">آمار (${successRate}%)</div>
          </div>
          
          <div class="tab-content active" id="examples-content">
            ${examples.length > 0 ? examples.map(ex => `
              <div class="example">
                <div class="example-header">
                  <strong>مثال:</strong>
                  <div>
                    <i class="fas fa-volume-up pronunciation-icon" data-word="${ex.german}"></i>
                  </div>
                </div>
                <p class="example-text">${ex.german}</p>
                <p class="example-translation">${ex.persian}</p>
              </div>
            `).join('') : '<p class="text-center py-3">مثالی ثبت نشده است</p>'}
            
            <div class="add-example-form mt-3">
              <h4>افزودن مثال جدید</h4>
              <div class="form-group">
                <label for="new-example-german">مثال (آلمانی):</label>
                <textarea id="new-example-german" class="form-control" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label for="new-example-persian">ترجمه (فارسی):</label>
                <textarea id="new-example-persian" class="form-control" rows="2"></textarea>
              </div>
              <button class="btn btn-primary" id="add-example-btn">افزودن مثال</button>
            </div>
          </div>
          
          <div class="tab-content" id="practice-content">
            ${practiceHistory.length > 0 ? `
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${successRate}%"></div>
              </div>
              <p class="text-center my-2">میزان موفقیت: ${successRate}%</p>
              
              <div class="practice-history">
                ${practiceHistory.slice(0, 10).map(record => `
                  <div class="practice-record ${record.correct ? 'correct' : 'incorrect'}">
                    <span>${new Date(record.date).toLocaleString('fa-IR')}</span>
                    <span>${record.correct ? '✅ صحیح' : '❌ نادرست'}</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-center py-3">تاریخچه‌ای برای تمرین این لغت وجود ندارد</p>'}
            
            <div class="action-buttons">
              <button class="btn btn-primary" id="practice-now-btn">تمرین الآن</button>
            </div>
          </div>
          
          <div class="tab-content" id="stats-content">
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-title">تعداد تمرین‌ها</div>
                <div class="stat-value">${practiceHistory.length}</div>
              </div>
              <div class="stat-card">
                <div class="stat-title">میزان موفقیت</div>
                <div class="stat-value">${successRate}%</div>
              </div>
              <div class="stat-card">
                <div class="stat-title">آخرین تمرین</div>
                <div class="stat-value">${practiceHistory.length > 0 
                  ? new Date(practiceHistory[0].date).toLocaleDateString('fa-IR') 
                  : '--'}</div>
              </div>
            </div>
          </div>
          
          <div class="action-buttons">
            <button class="btn btn-outline" id="edit-word-btn">ویرایش لغت</button>
            <button class="btn btn-danger" id="delete-word-btn">حذف لغت</button>
          </div>
        </div>
      `;
      
      // Add event listeners
      document.querySelector('.favorite-icon').addEventListener('click', async () => {
        const wordId = word.id;
        await this.toggleFavorite(wordId);
        document.querySelector('.favorite-icon').classList.toggle('active');
      });
      
      document.getElementById('add-example-btn')?.addEventListener('click', async () => {
        const german = document.getElementById('new-example-german').value;
        const persian = document.getElementById('new-example-persian').value;
        
        if (german && persian) {
          await this.addExample(word.id, { german, persian });
          document.getElementById('new-example-german').value = '';
          document.getElementById('new-example-persian').value = '';
        } else {
          this.showToast('لطفاً هر دو فیلد را پر کنید', 'error');
        }
      });
      
      document.getElementById('practice-now-btn')?.addEventListener('click', () => {
        this.startPracticeSession([word.id]);
      });
      
      document.getElementById('edit-word-btn')?.addEventListener('click', () => {
        this.showEditWordForm(word);
      });
      
      document.getElementById('delete-word-btn')?.addEventListener('click', async () => {
        if (confirm('آیا از حذف این لغت مطمئن هستید؟')) {
          await this.deleteWord(word.id);
          this.showSection('word-list-section');
        }
      });
      
      // Setup tabs
      this.setupTabs();
      
      // Setup pronunciation buttons
      this.setupPronunciationButtons();
      this.setupSearchEventListeners();
    }
    setupSearchEventListeners() {
    // Search functionality
   document.getElementById('search-btn')?.addEventListener('click', () => {
    const query = document.getElementById('search-input').value.trim();
    if (query) {
        this.renderSearchResults(query);
    }
});

document.getElementById('search-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = document.getElementById('search-input').value.trim();
        if (query) {
            this.renderSearchResults(query);
        }
    }
});
    
    document.getElementById('search-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('search-btn').click();
        }
    });
}
    showEditWordForm(word) {
      document.getElementById('add-word-section').innerHTML = `
        <h2>ویرایش لغت</h2>
        <div class="word-card">
          <div class="form-group">
            <label for="edit-german-word">لغت آلمانی:</label>
            <input type="text" id="edit-german-word" class="form-control" value="${word.german}">
          </div>
          <div class="form-group">
            <label for="edit-persian-meaning">معنی فارسی:</label>
            <input type="text" id="edit-persian-meaning" class="form-control" value="${word.persian}">
          </div>
          <div class="form-group">
            <label>جنسیت:</label>
            <div class="gender-options">
              <button class="gender-btn masculine ${word.gender === 'masculine' ? 'active' : ''}" data-gender="masculine">مذکر (der)</button>
              <button class="gender-btn feminine ${word.gender === 'feminine' ? 'active' : ''}" data-gender="feminine">مونث (die)</button>
              <button class="gender-btn neuter ${word.gender === 'neuter' ? 'active' : ''}" data-gender="neuter">خنثی (das)</button>
              <button class="gender-btn none ${!word.gender ? 'active' : ''}" data-gender="none">بدون جنسیت</button>
            </div>
          </div>
          <div class="form-group">
            <label for="edit-word-type">نوع کلمه:</label>
            <select id="edit-word-type" class="form-control">
              <option value="noun" ${word.type === 'noun' ? 'selected' : ''}>اسم</option>
              <option value="verb" ${word.type === 'verb' ? 'selected' : ''}>فعل</option>
              <option value="adjective" ${word.type === 'adjective' ? 'selected' : ''}>صفت</option>
              <option value="adverb" ${word.type === 'adverb' ? 'selected' : ''}>قید</option>
              <option value="other" ${word.type === 'other' || !word.type ? 'selected' : ''}>سایر</option>
            </select>
          </div>
          
          ${word.type === 'verb' ? `
            <div class="form-group verb-forms">
              <label>صرف فعل:</label>
              <div class="verb-form-row">
                <div>
                  <div class="verb-form-label">حال ساده</div>
                  <input type="text" id="edit-verb-present" class="form-control" value="${word.verbForms?.present || ''}">
                </div>
                <div>
                  <div class="verb-form-label">گذشته</div>
                  <input type="text" id="edit-verb-past" class="form-control" value="${word.verbForms?.past || ''}">
                </div>
                <div>
                  <div class="verb-form-label">گذشته کامل</div>
                  <input type="text" id="edit-verb-perfect" class="form-control" value="${word.verbForms?.perfect || ''}">
                </div>
              </div>
            </div>
          ` : ''}
          
          <div class="action-buttons">
            <button class="btn btn-primary" id="save-edit-btn">ذخیره تغییرات</button>
            <button class="btn btn-outline" id="cancel-edit-btn">انصراف</button>
          </div>
        </div>
      `;
      
      // Show verb forms if verb is selected
      document.getElementById('edit-word-type').addEventListener('change', function() {
        const verbFormsDiv = document.querySelector('.verb-forms');
        if (this.value === 'verb') {
          verbFormsDiv.style.display = 'block';
        } else {
          verbFormsDiv.style.display = 'none';
        }
      });
      
      // Save edited word
      document.getElementById('save-edit-btn').addEventListener('click', async () => {
        const german = document.getElementById('edit-german-word').value;
        const persian = document.getElementById('edit-persian-meaning').value;
        const gender = document.querySelector('.gender-btn.active')?.getAttribute('data-gender') || null;
        const type = document.getElementById('edit-word-type').value;
        
        const updatedWord = {
          ...word,
          german,
          persian,
          gender,
          type
        };
        
        if (type === 'verb') {
          updatedWord.verbForms = {
            present: document.getElementById('edit-verb-present').value,
            past: document.getElementById('edit-verb-past').value,
            perfect: document.getElementById('edit-verb-perfect').value
          };
        } else {
          updatedWord.verbForms = null;
        }
        
        const transaction = this.db.transaction(['words'], 'readwrite');
        const store = transaction.objectStore('words');
        const request = store.put(updatedWord);
        
        request.onsuccess = () => {
          this.showToast('لغت با موفقیت ویرایش شد', 'success');
          this.renderWordDetails(updatedWord);
          this.showSection('search-section');
        };
        
        request.onerror = () => {
          this.showToast('خطا در ویرایش لغت', 'error');
        };
      });
      
      document.getElementById('cancel-edit-btn').addEventListener('click', () => {
        this.showSection('search-section');
      });
      
      this.showSection('add-word-section');
    }

    // =====================
    // Practice System
   async startPracticeSession(wordIds = null) {
    let wordsToPractice;
    
    if (!wordIds) {
        // اگر لیست خاصی مشخص نشده، از همه لغات استفاده کن
        const allWords = await this.getAllWords();
        wordsToPractice = this.shuffleArray([...allWords]); // تصادفی کردن ترتیب لغات
    } else {
        // اگر لیست خاصی داده شده، آن‌ها را تصادفی کن
        const words = await Promise.all(wordIds.map(id => this.getWord(id)));
        wordsToPractice = this.shuffleArray(words);
    }

    this.practiceSession = {
        words: wordsToPractice, // ذخیره لغات به جای IDها
        currentIndex: 0,
        correct: 0,
        incorrect: 0
    };
    
    this.showNextPracticeWord();
    this.showSection('practice-section');
}

    async showNextPracticeWord() {
      if (this.practiceSession.currentIndex >= this.practiceSession.words.length) {
        this.showPracticeResults();
        return;
      }
      
     const word = this.practiceSession.words[this.practiceSession.currentIndex];
      
      // Randomly decide to show German or Persian first (50/50 chance)
      const showGermanFirst = Math.random() > 0.5;
      
      document.getElementById('practice-section').innerHTML = `
        <div class="flashcard" id="practice-flashcard">
          <div class="flashcard-inner">
            <div class="flashcard-front">
              <div class="flashcard-word">
                ${showGermanFirst ? word.german : word.persian}
              </div>
              ${word.gender ? `<span class="word-gender ${word.gender}">${this.getGenderSymbol(word.gender)}</span>` : ''}
              ${word.type ? `<span class="word-type">${this.getTypeLabel(word.type)}</span>` : ''}
              <div class="flashcard-actions">
                <button class="btn btn-outline" id="flip-card-btn">نمایش پاسخ</button>
              </div>
            </div>
            <div class="flashcard-back">
              <div class="flashcard-word">
                ${showGermanFirst ? word.persian : word.german}
              </div>
              ${word.gender ? `<span class="word-gender ${word.gender}">${this.getGenderSymbol(word.gender)}</span>` : ''}
              ${word.type ? `<span class="word-type">${this.getTypeLabel(word.type)}</span>` : ''}
              
              ${word.verbForms ? `
                <div class="verb-forms mt-3">
                  <div class="verb-form-row">
                    <div>
                      <div class="verb-form-label">حال ساده</div>
                      <input type="text" class="form-control" value="${word.verbForms.present || ''}" readonly>
                    </div>
                    <div>
                      <div class="verb-form-label">گذشته</div>
                      <input type="text" class="form-control" value="${word.verbForms.past || ''}" readonly>
                    </div>
                    <div>
                      <div class="verb-form-label">گذشته کامل</div>
                      <input type="text" class="form-control" value="${word.verbForms.perfect || ''}" readonly>
                    </div>
                  </div>
                </div>
              ` : ''}
              
              <div class="flashcard-actions">
                <button class="btn btn-success" id="correct-btn">بلدم ✅</button>
                <button class="btn btn-danger" id="incorrect-btn">نبلدم ❌</button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${(this.practiceSession.currentIndex / this.practiceSession.words.length) * 100}%"></div>
        </div>
        <p class="text-center mt-2">
          ${this.practiceSession.currentIndex + 1} از ${this.practiceSession.words.length}
        </p>
      `;
      
      document.getElementById('flip-card-btn').addEventListener('click', () => {
        document.getElementById('practice-flashcard').classList.add('flipped');
      });
      
      document.getElementById('correct-btn').addEventListener('click', async () => {
        await this.recordPractice(word.id, true);
        this.practiceSession.correct++;
        this.practiceSession.currentIndex++;
        this.showNextPracticeWord();
      });
      
      document.getElementById('incorrect-btn').addEventListener('click', async () => {
        await this.recordPractice(word.id, false);
        this.practiceSession.incorrect++;
        this.practiceSession.currentIndex++;
        this.showNextPracticeWord();
      });
    }

    showPracticeResults() {
      const accuracy = this.practiceSession.wordIds.length > 0 
        ? Math.round((this.practiceSession.correct / this.practiceSession.wordIds.length) * 100) 
        : 0;
      
      document.getElementById('practice-section').innerHTML = `
        <div class="word-card text-center">
          <h3>نتایج تمرین</h3>
          <div class="stats-grid my-4">
            <div class="stat-card">
              <div class="stat-title">تعداد لغات</div>
              <div class="stat-value">${this.practiceSession.wordIds.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">پاسخ صحیح</div>
              <div class="stat-value">${this.practiceSession.correct}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">پاسخ نادرست</div>
              <div class="stat-value">${this.practiceSession.incorrect}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">میزان دقت</div>
              <div class="stat-value">${accuracy}%</div>
            </div>
          </div>
          
          <div class="action-buttons">
            <button class="btn btn-primary" id="practice-again-btn">تمرین مجدد</button>
            <button class="btn btn-outline" id="back-to-words-btn">بازگشت به لغات</button>
          </div>
        </div>
      `;
      
      document.getElementById('practice-again-btn').addEventListener('click', () => {
        this.startPracticeSession(this.practiceSession.wordIds);
      });
      
      document.getElementById('back-to-words-btn').addEventListener('click', () => {
        this.showSection('word-list-section');
      });
    }

    // =====================
    // Quiz System
    // =====================
    async startQuiz() {
      const words = await this.getAllWords();
      if (words.length < 4) {
        this.showToast('حداقل به ۴ لغت برای شروع آزمون نیاز دارید', 'error');
        return;
      }
      
      this.quizSession = {
        words: this.shuffleArray([...words]),
        currentIndex: 0,
        score: 0,
        questions: []
      };
      
      this.prepareNextQuizQuestion();
      this.showSection('quiz-section');
    }

    prepareNextQuizQuestion() {
  if (this.quizSession.currentIndex >= 10 || 
      this.quizSession.currentIndex >= this.quizSession.words.length) {
    this.showQuizResults();
    return;
  }
  
  const correctWord = this.quizSession.words[this.quizSession.currentIndex];
  
  // Randomly decide question type (50/50 chance)
  const questionType = Math.random() > 0.5 ? 'meaning' : 'word';
  
  // Prepare 3 random wrong answers
  const wrongAnswers = [];
  const usedIndices = new Set([this.quizSession.currentIndex]);
  
  while (wrongAnswers.length < 3 && usedIndices.size < this.quizSession.words.length) {
    const randomIndex = Math.floor(Math.random() * this.quizSession.words.length);
    if (!usedIndices.has(randomIndex)) {
      wrongAnswers.push(
        questionType === 'meaning' 
          ? this.quizSession.words[randomIndex].persian // برای سوالات معنی، گزینه‌های نادرست فارسی
          : this.quizSession.words[randomIndex].german  // برای سوالات معادل آلمانی، گزینه‌های نادرست آلمانی
      );
      usedIndices.add(randomIndex);
    }
  }
  
  // تعیین پاسخ صحیح بر اساس نوع سوال
  const correctAnswer = questionType === 'meaning' 
    ? correctWord.persian 
    : correctWord.german;
  
  // Combine and shuffle options
  const options = this.shuffleArray([
    correctAnswer,
    ...wrongAnswers
  ]);
  
  const question = {
    word: correctWord,
    questionType,
    options,
    correctAnswer,
    userAnswer: null,
    isCorrect: null
  };
  
  this.quizSession.questions.push(question);
  this.renderQuizQuestion(question);
}

    renderQuizQuestion(question) {
      document.getElementById('quiz-section').innerHTML = `
        <div class="word-card">
          <div class="quiz-question">
            ${question.questionType === 'meaning' 
              ? `معنی لغت <strong>${question.word.german}</strong> چیست؟`
              : `کدام گزینه معادل آلمانی <strong>${question.word.persian}</strong> است؟`}
          </div>
          
          <div class="quiz-options">
            ${question.options.map((option, index) => `
              <div class="quiz-option" data-index="${index}">
                ${String.fromCharCode(1776 + index)}. ${option}
              </div>
            `).join('')}
          </div>
          
          <div class="quiz-feedback ${question.isCorrect ? 'correct' : 'incorrect'}" 
               style="display: ${question.userAnswer !== null ? 'block' : 'none'}">
            ${question.isCorrect 
              ? '✅ پاسخ شما صحیح است!' 
              : `❌ پاسخ صحیح: ${question.correctAnswer}`}
          </div>
          
          <div class="quiz-nav">
            <button class="btn btn-outline" id="quiz-skip-btn" 
                    ${question.userAnswer !== null ? 'disabled' : ''}>رد کردن</button>
            <div>
              سوال ${this.quizSession.currentIndex + 1} از ${Math.min(10, this.quizSession.words.length)}
            </div>
            <button class="btn btn-primary" id="quiz-next-btn" 
                    ${question.userAnswer === null ? 'disabled' : ''}>
              ${this.quizSession.currentIndex + 1 >= Math.min(10, this.quizSession.words.length) 
                ? 'مشاهده نتایج' 
                : 'بعدی'}
            </button>
          </div>
        </div>
      `;
      
      // Add event listeners
      document.querySelectorAll('.quiz-option').forEach(option => {
        option.addEventListener('click', () => {
          if (question.userAnswer !== null) return;
          
          const selectedIndex = parseInt(option.getAttribute('data-index'));
          const selectedAnswer = question.options[selectedIndex];
          
          question.userAnswer = selectedAnswer;
          question.isCorrect = selectedAnswer === question.correctAnswer;
          
          if (question.isCorrect) {
            this.quizSession.score++;
          }
          
          // Highlight selected option
          document.querySelectorAll('.quiz-option').forEach(opt => {
            opt.classList.remove('selected', 'correct', 'incorrect');
          });
          
          option.classList.add('selected');
          option.classList.add(question.isCorrect ? 'correct' : 'incorrect');
          
          // Show feedback
          document.querySelector('.quiz-feedback').style.display = 'block';
          
          // Enable next button
          document.getElementById('quiz-next-btn').disabled = false;
        });
      });
      
      document.getElementById('quiz-skip-btn').addEventListener('click', () => {
        this.quizSession.currentIndex++;
        this.prepareNextQuizQuestion();
      });
      
      document.getElementById('quiz-next-btn').addEventListener('click', () => {
        this.quizSession.currentIndex++;
        this.prepareNextQuizQuestion();
      });
    }

    showQuizResults() {
      const scorePercentage = Math.round((this.quizSession.score / this.quizSession.questions.length) * 100);
      
      document.getElementById('quiz-section').innerHTML = `
        <div class="word-card text-center">
          <h3>نتایج آزمون</h3>
          
          <div class="progress-circle mx-auto my-4" style="background: conic-gradient(
            #2ecc71 0% ${scorePercentage}%, 
            #e74c3c ${scorePercentage}% 100%
          );">
            <div class="progress-circle-inner">
              <span>${scorePercentage}%</span>
            </div>
          </div>
          
          <p class="my-3">
            شما ${this.quizSession.score} از ${this.quizSession.questions.length} سوال را صحیح پاسخ دادید
          </p>
          
          <div class="quiz-results-details">
            ${this.quizSession.questions.map((q, i) => `
              <div class="quiz-result-item ${q.isCorrect ? 'correct' : 'incorrect'}">
                <div class="quiz-result-question">
                  <span>سوال ${i + 1}:</span>
                  ${q.questionType === 'meaning' 
                    ? `معنی <strong>${q.word.german}</strong>` 
                    : `معادل آلمانی <strong>${q.word.persian}</strong>`}
                </div>
                <div class="quiz-result-answer">
                  ${q.isCorrect ? '✅' : '❌'} پاسخ شما: ${q.userAnswer || '--'}
                </div>
              </div>
            `).join('')}
          </div>
          
          <div class="action-buttons mt-4">
            <button class="btn btn-primary" id="quiz-restart-btn">شروع آزمون جدید</button>
            <button class="btn btn-outline" id="quiz-back-btn">بازگشت به منو</button>
          </div>
        </div>
      `;
      
      document.getElementById('quiz-restart-btn').addEventListener('click', () => {
        this.startQuiz();
      });
      
      document.getElementById('quiz-back-btn').addEventListener('click', () => {
        this.showSection('word-list-section');
      });
    }

    // =====================
    // Stats & Reports
    // =====================
   async updateStats() {
    const words = await this.getAllWords();
    const practiceHistory = await this.getAllPracticeHistory();
    
    const totalWords = words.length;
    const totalFavorites = this.favorites.size;
    const totalPractice = practiceHistory.length;
    const correctPractice = practiceHistory.filter(h => h.correct).length;
    const accuracy = totalPractice > 0 ? Math.round((correctPractice / totalPractice) * 100) : 0;
    
    // تصادفی کردن ۱۰ لغت اخیر
    const recentWords = this.shuffleArray([...words]).slice(0, 10);
    
    document.getElementById('progress-section').innerHTML = `
        <h2>آمار و پیشرفت</h2>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-title">تعداد لغات</div>
                <div class="stat-value">${totalWords}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">علاقه‌مندی‌ها</div>
                <div class="stat-value">${totalFavorites}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">تمرین‌ها</div>
                <div class="stat-value">${totalPractice}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">میزان دقت</div>
                <div class="stat-value">${accuracy}%</div>
            </div>
        </div>
        
        <div class="word-card mt-4">
            <h3 class="mb-3">۱۰ لغت تصادفی</h3>
            <div class="word-list">
                ${recentWords.map(word => `
                    <div class="word-list-item" data-id="${word.id}">
                        <div class="word-list-item-header">
                            <div>
                                <span class="word-list-item-title">${word.german}</span>
                                ${word.gender ? `<span class="word-gender ${word.gender}">${this.getGenderSymbol(word.gender)}</span>` : ''}
                            </div>
                            <i class="fas fa-star favorite-icon ${this.favorites.has(word.id) ? 'active' : ''}" data-id="${word.id}"></i>
                        </div>
                        <div class="word-list-item-meaning">${word.persian}</div>
                        <div class="word-list-item-actions">
                            <button class="btn btn-sm btn-outline view-word" data-id="${word.id}">مشاهده</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Add event listeners
    document.querySelectorAll('.favorite-icon').forEach(icon => {
        icon.addEventListener('click', async (e) => {
            e.stopPropagation();
            const wordId = parseInt(icon.getAttribute('data-id'));
            await this.toggleFavorite(wordId);
            icon.classList.toggle('active');
            this.updateStats(); // بروزرسانی پس از تغییر علاقه‌مندی
        });
    });
    
    document.querySelectorAll('.view-word').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const wordId = parseInt(btn.getAttribute('data-id'));
            const word = await this.getWord(wordId);
            this.renderWordDetails(word);
            this.showSection('search-section');
        });
    });
}
    async getAllPracticeHistory() {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['practiceHistory'], 'readonly');
        const store = transaction.objectStore('practiceHistory');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
      });
    }

    // =====================
    // Settings
    // =====================
    renderSettings() {
      const isDarkMode = localStorage.getItem('darkMode') === 'true';
      
      document.getElementById('settings-section').innerHTML = `
        <h2>تنظیمات</h2>
        
        <div class="word-card">
          <h3 class="mb-3">ظاهر برنامه</h3>
          
          <div class="form-group">
            <label>حالت تاریک:</label>
            <label class="switch">
              <input type="checkbox" id="dark-mode-toggle" ${isDarkMode ? 'checked' : ''}>
              <span class="slider round"></span>
            </label>
          </div>
          
          <div class="form-group">
            <label for="font-size-select">اندازه فونت:</label>
            <select id="font-size-select" class="form-control">
              <option value="small">کوچک</option>
              <option value="medium" selected>متوسط</option>
              <option value="large">بزرگ</option>
            </select>
          </div>
        </div>
        
        <div class="word-card mt-4">
          <h3 class="mb-3">مدیریت داده‌ها</h3>
          
          <div class="action-buttons">
            <button class="btn btn-outline" id="export-data-btn">صدور داده‌ها</button>
            <button class="btn btn-outline" id="import-data-btn">ورود داده‌ها</button>
            <button class="btn btn-danger" id="reset-data-btn">بازنشانی برنامه</button>
          </div>
        </div>
      `;
      
      // Setup event listeners
      document.getElementById('dark-mode-toggle').addEventListener('change', (e) => {
        localStorage.setItem('darkMode', e.target.checked);
        document.body.classList.toggle('dark-mode', e.target.checked);
      });
      
      document.getElementById('font-size-select').addEventListener('change', (e) => {
        document.body.style.fontSize = e.target.value === 'small' ? '14px' : 
                                      e.target.value === 'large' ? '18px' : '16px';
      });
      
      document.getElementById('export-data-btn').addEventListener('click', () => {
        this.exportData();
      });
      
      document.getElementById('import-data-btn').addEventListener('click', () => {
        document.getElementById('import-file-input')?.click();
      });
      
      document.getElementById('reset-data-btn').addEventListener('click', () => {
        if (confirm('آیا مطمئن هستید؟ تمام داده‌های برنامه حذف خواهند شد.')) {
          this.resetData();
        }
      });
      
      // Create hidden file input for import
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'import-file-input';
      fileInput.style.display = 'none';
      fileInput.accept = '.json';
      fileInput.addEventListener('change', (e) => {
        this.importData(e.target.files[0]);
      });
      document.body.appendChild(fileInput);
    }

    async exportData() {
      const [words, favorites, examples, practiceHistory] = await Promise.all([
        this.getAllWords(),
        new Promise(resolve => {
          const transaction = this.db.transaction(['favorites'], 'readonly');
          const store = transaction.objectStore('favorites');
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
        }),
        new Promise(resolve => {
          const transaction = this.db.transaction(['examples'], 'readonly');
          const store = transaction.objectStore('examples');
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
        }),
        new Promise(resolve => {
          const transaction = this.db.transaction(['practiceHistory'], 'readonly');
          const store = transaction.objectStore('practiceHistory');
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
        })
      ]);
      
      const data = {
        words,
        favorites,
        examples,
        practiceHistory,
        exportedAt: new Date().toISOString(),
        version: 1
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `german-dictionary-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showToast('داده‌ها با موفقیت صادر شد', 'success');
    }

    async importData(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.words || !Array.isArray(data.words)) {
      throw new Error('فرمت فایل نامعتبر است');
    }

    // 1. حذف دیتابیس موجود
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(this.dbName);
      req.onsuccess = resolve;
      req.onerror = reject;
    });

    // 2. راه‌اندازی مجدد دیتابیس
    await this.initDB();

    // 3. اضافه کردن داده‌های جدید
    await new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['words', 'favorites', 'examples', 'practiceHistory'], 'readwrite');
      
      const wordsStore = transaction.objectStore('words');
      const favoritesStore = transaction.objectStore('favorites');
      const examplesStore = transaction.objectStore('examples');
      const practiceStore = transaction.objectStore('practiceHistory');

      // اضافه کردن لغات
      data.words.forEach(word => {
        wordsStore.add(word);
      });

      // اضافه کردن علاقه‌مندی‌ها
      if (data.favorites && Array.isArray(data.favorites)) {
        data.favorites.forEach(fav => {
          favoritesStore.add(fav);
        });
      }

      // اضافه کردن مثال‌ها
      if (data.examples && Array.isArray(data.examples)) {
        data.examples.forEach(ex => {
          examplesStore.add(ex);
        });
      }

      // اضافه کردن تاریخچه تمرین
      if (data.practiceHistory && Array.isArray(data.practiceHistory)) {
        data.practiceHistory.forEach(rec => {
          practiceStore.add(rec);
        });
      }

      transaction.oncomplete = () => {
        this.loadFavorites().then(resolve).catch(reject);
      };

      transaction.onerror = (event) => {
        reject(event.target.error);
      };
    });

    this.showToast('داده‌ها با موفقیت وارد شدند', 'success');
    this.renderWordList();
    this.updateStats();

  } catch (error) {
    console.error('Import error:', error);
    this.showToast('خطا در وارد کردن داده‌ها: ' + error.message, 'error');
  }
}
    async clearDatabase() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(this.dbName);
        
        request.onsuccess = () => {
          this.db = null;
          this.favorites = new Set();
          resolve();
        };
        
        request.onerror = (event) => {
          reject(event.target.error);
        };
      });
    }

    async resetData() {
      await this.clearDatabase();
      localStorage.clear();
      location.reload();
    }

    // =====================
    // Helper Methods
    // =====================
    showSection(sectionId) {
      document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
      });
      document.getElementById(sectionId).classList.add('active');
    }

    setupTabs() {
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const tabId = tab.getAttribute('data-tab');
          
          // Update active tab
          document.querySelectorAll('.tab').forEach(t => {
            t.classList.remove('active');
          });
          tab.classList.add('active');
          
          // Update active content
          document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
          });
          document.getElementById(`${tabId}-content`).classList.add('active');
        });
      });
    }

    setupPronunciationButtons() {
      document.querySelectorAll('.pronunciation-icon').forEach(btn => {
        btn.addEventListener('click', () => {
          const word = btn.getAttribute('data-word');
          this.speakWord(word, 'de-DE');
        });
      });
    }

    speakWord(text, lang) {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        window.speechSynthesis.speak(utterance);
      } else {
        this.showToast('مرورگر شما از تبدیل متن به گفتار پشتیبانی نمی‌کند', 'error');
      }
    }

    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                         type === 'error' ? 'fa-times-circle' : 
                         'fa-info-circle'}"></i>
        <span>${message}</span>
        <i class="fas fa-times toast-close"></i>
      `;
      
      document.body.appendChild(toast);
      
      // Auto remove after 5 seconds
      setTimeout(() => {
        toast.remove();
      }, 5000);
      
      // Close button
      toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
      });
    }

    getGenderLabel(gender) {
      return {
        masculine: 'der (مذکر)',
        feminine: 'die (مونث)',
        neuter: 'das (خنثی)'
      }[gender];
    }

    getGenderSymbol(gender) {
      return {
        masculine: 'der',
        feminine: 'die',
        neuter: 'das'
      }[gender];
    }

    getTypeLabel(type) {
      return {
        noun: 'اسم',
        verb: 'فعل',
        adjective: 'صفت',
        adverb: 'قید',
        other: 'سایر'
      }[type];
    }

    shuffleArray(array) {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    }

    // =====================
    // Event Listeners
    // =====================
    setupEventListeners() {
      // Search functionality
      document.getElementById('search-btn')?.addEventListener('click', () => {
        const query = document.getElementById('search-input').value;
        if (query) {
          this.searchWords(query).then(results => {
            if (results.length > 0) {
              this.renderWordDetails(results[0]);
            } else {
              this.showToast('هیچ نتیجه‌ای یافت نشد', 'info');
            }
          });
        }
      });
      
      document.getElementById('search-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          document.getElementById('search-btn').click();
        }
      });
      
      // Add word form
      document.getElementById('save-word-btn')?.addEventListener('click', async () => {
        const german = document.getElementById('german-word').value;
        const persian = document.getElementById('persian-meaning').value;
        const gender = document.querySelector('.gender-btn.active')?.getAttribute('data-gender') || null;
        const type = document.getElementById('word-type').value;
        
        if (!german || !persian) {
          this.showToast('لطفاً هر دو فیلد لغت و معنی را پر کنید', 'error');
          return;
        }
        
        const wordData = {
          german,
          persian,
          gender,
          type
        };
        console.log('gender selected:', gender);
          if (type === 'verb') {
    const present = document.getElementById('verb-present')?.value.trim() || '';
    const past = document.getElementById('verb-past')?.value.trim() || '';
    const perfect = document.getElementById('verb-perfect')?.value.trim() || '';

    // فقط اگر حداقل یکی پر باشد، اضافه کن
    if (present || past || perfect) {
      wordData.verbForms = { present, past, perfect };
    }
  }
        
  console.log(JSON.stringify(wordData, null, 2)); 
        await this.addWord(wordData);
        
        // Clear form
        document.getElementById('german-word').value = '';
        document.getElementById('persian-meaning').value = '';
        document.querySelectorAll('.gender-btn').forEach(btn => {
          btn.classList.remove('active');
        });
        
        document.getElementById('verb-present').value = '';
        document.getElementById('verb-past').value = '';
        document.getElementById('verb-perfect').value = '';
      });
      
      // Gender selection
      document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          document.querySelectorAll('.gender-btn').forEach(b => {
            b.classList.remove('active');
          });
          this.classList.add('active');
        });
      });
      
      // Show/hide verb forms based on word type
      document.getElementById('word-type')?.addEventListener('change', function() {
        const verbFormsDiv = document.querySelector('.verb-forms');
        if (this.value === 'verb') {
          verbFormsDiv.style.display = 'block';
        } else {
          verbFormsDiv.style.display = 'none';
        }
      });
      
      // Menu navigation
      document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
          const sectionId = item.getAttribute('data-section') + '-section';
          
          // Special handling for some sections
          if (sectionId === 'progress-section') {
            this.updateStats();
          } else if (sectionId === 'settings-section') {
            this.renderSettings();
          } else if (sectionId === 'quiz-section') {
            this.startQuiz();
          } else if (sectionId === 'flashcards-section') {
            this.startPracticeSession();
          }
          
          this.showSection(sectionId);
          
          // Update active menu item
          document.querySelectorAll('.menu-item').forEach(i => {
            i.classList.remove('active');
          });
          item.classList.add('active');
        });
      });
      
      // Initialize dark mode
      if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
      }
    }
  }

  // Initialize the app
  const dictionaryApp = new GermanDictionary();
});

// در متد setupEventListeners()، بعد از بخش مربوط به فرم اضافه کردن لغت، این کد را اضافه کنید:

// Enter key submission in add word form
document.getElementById('german-word')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault(); // از submit شدن فرم جلوگیری می‌کند
    document.getElementById('persian-meaning').focus();
  }
});

document.getElementById('persian-meaning')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault(); // از submit شدن فرم جلوگیری می‌کند
    
    const wordType = document.getElementById('word-type').value;
    if (wordType === 'verb') {
      document.getElementById('verb-present').focus();
    } else {
      document.querySelector('.gender-btn').focus();
    }
  }
});

// برای فیلدهای صرف فعل:
document.getElementById('verb-present')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('verb-past').focus();
  }
});

document.getElementById('verb-past')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('verb-perfect').focus();
  }
});

document.getElementById('verb-perfect')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.querySelector('.gender-btn').focus();
  }
});

// برای دکمه‌های جنسیت:
document.querySelectorAll('.gender-btn').forEach(btn => {
  btn.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // فقط دکمه جنسیت را انتخاب کند و فرم submit نشود
      btn.click();
    }
  });
  
  btn.setAttribute('tabindex', '0');
});

// تغییر در دکمه ذخیره:
document.getElementById('save-word-btn')?.addEventListener('click', async (e) => {
  e.preventDefault(); // از submit سنتی فرم جلوگیری می‌کند
  await this.saveWord();
});
// در متد setupEventListeners()، بعد از کدهای قبلی این قسمت را اضافه کنید:

// Enter key submission for gender buttons
document.querySelectorAll('.gender-btn').forEach(btn => {
  btn.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('save-word-btn').click();
    }
  });
  
  // این قسمت برای focus گرفتن با کلید Tab و سپس Enter
  btn.setAttribute('tabindex', '0');
});




