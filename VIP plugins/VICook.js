/**
 * VICook.js - VIP плагин для работы с куки и различными хранилищами
 * Версия: 1.0.0
 * 
 * Этот премиум плагин предоставляет расширенные возможности для работы:
 * - Куки (создание, чтение, удаление)
 * - Локальные и сессионные хранилища
 * - IndexedDB
 * - Синхронизация между хранилищами
 * - Управление квотами и автоматическая оптимизация
 * - Мониторинг и аналитика
 * 
 * Требует STlocal.js версии 2.0+
 */

class VICook {
  constructor(options = {}) {
    // Настройки по умолчанию
    this.defaultOptions = {
      cookie: {
        domain: window.location.hostname,
        path: '/',
        secure: window.location.protocol === 'https:',
        sameSite: 'Lax'
      },
      storage: {
        default: 'auto', // auto, cookie, localStorage, sessionStorage, indexedDB
        sync: true,
        syncInterval: 5000
      },
      indexedDB: {
        name: 'VICookDB',
        version: 1,
        objectStores: [
          { name: 'keyValue', keyPath: 'key', autoIncrement: false }
        ]
      },
      analytics: true,
      compression: false,
      quotaManagement: true
    };
    
    // Слияние пользовательских настроек
    this.options = { ...this.defaultOptions, ...options };
    this.storage = null;
    this.syncInterval = null;
    this.db = null;
    this.eventHandlers = {};
    this.storageTypes = ['cookie', 'localStorage', 'sessionStorage', 'indexedDB'];
    
    // Данные аналитики
    this.analyticsData = {
      operations: { get: 0, set: 0, remove: 0 },
      storageUsage: {}
    };
  }
  
  /**
   * Инициализация плагина
   * @param {STlocal} storage - Экземпляр STlocal
   */
  init(storage) {
    this.storage = storage;
    
    // Инициализация IndexedDB
    this._initIndexedDB();
    
    // Инициализация аналитики
    if (this.options.analytics) {
      this._initAnalytics();
    }
    
    // Запуск синхронизации
    if (this.options.storage.sync) {
      this._startSync();
    }
    
    // Инициализация квот
    if (this.options.quotaManagement) {
      this._initQuotaManagement();
    }
    
    // Регистрация обработчиков
    this._registerHooks();
  }
  
  /**
   * Инициализация IndexedDB
   * @private
   */
  _initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(
        this.options.indexedDB.name, 
        this.options.indexedDB.version
      );
      
      request.onerror = (event) => {
        console.error('VICook: IndexedDB error', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this.options.indexedDB.objectStores.forEach(store => {
          if (!db.objectStoreNames.contains(store.name)) {
            db.createObjectStore(store.name, {
              keyPath: store.keyPath,
              autoIncrement: store.autoIncrement
            });
          }
        });
      };
    });
  }
  
  /**
   * Инициализация аналитики
   * @private
   */
  _initAnalytics() {
    // Периодическое обновление статистики
    setInterval(() => this._updateStorageUsage(), 30000);
    
    // Сохранение аналитических данных
    this._updateStorageUsage();
  }
  
  /**
   * Обновление данных об использовании хранилищ
   * @private
   */
  _updateStorageUsage() {
    this.storageTypes.forEach(type => {
      this.analyticsData.storageUsage[type] = this._getStorageSize(type);
    });
  }
  
  /**
   * Запуск синхронизации между хранилищами
   * @private
   */
  _startSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    
    this.syncInterval = setInterval(() => {
      this._syncStorages();
    }, this.options.storage.syncInterval);
    
    // Синхронизация при загрузке
    this._syncStorages();
  }
  
  /**
   * Инициализация управления квотами
   * @private
   */
  _initQuotaManagement() {
    // Проверка квот каждые 5 минут
    setInterval(() => this._checkQuotas(), 300000);
    
    // Первоначальная проверка
    this._checkQuotas();
  }
  
  /**
   * Регистрация хуков
   * @private
   */
  _registerHooks() {
    this.storage.use({
      hooks: {
        afterSet: this._afterSet.bind(this),
        afterGet: this._afterGet.bind(this),
        afterRemove: this._afterRemove.bind(this)
      }
    });
  }
  
  /**
   * Хук после сохранения данных
   * @private
   */
  _afterSet({ key, value, options }) {
    // Обновление аналитики
    this.analyticsData.operations.set++;
    
    // Синхронизация с другими хранилищами
    if (options && !options.skipSync) {
      this._syncKey(key, 'set', value, options);
    }
  }
  
  /**
   * Хук после получения данных
   * @private
   */
  _afterGet({ key, value }) {
    // Обновление аналитики
    this.analyticsData.operations.get++;
    
    return { key, value };
  }
  
  /**
   * Хук после удаления данных
   * @private
   */
  _afterRemove({ key }) {
    // Обновление аналитики
    this.analyticsData.operations.remove++;
    
    // Синхронизация с другими хранилищами
    this._syncKey(key, 'remove');
  }
  
  /**
   * Синхронизация ключа между хранилищами
   * @private
   */
  _syncKey(key, action, value = null, options = {}) {
    // Определение хранилищ для синхронизации
    const syncStorages = this._getSyncStorages();
    
    syncStorages.forEach(storageType => {
      if (action === 'set') {
        this._setToStorage(storageType, key, value, options);
      } else if (action === 'remove') {
        this._removeFromStorage(storageType, key);
      }
    });
  }
  
  /**
   * Синхронизация всех хранилищ
   * @private
   */
  _syncStorages() {
    const syncStorages = this._getSyncStorages();
    
    // Синхронизация из основного хранилища в другие
    const mainKeys = this.storage.keys();
    
    mainKeys.forEach(key => {
      const value = this.storage.get(key);
      syncStorages.forEach(storageType => {
        this._setToStorage(storageType, key, value, { skipSync: true });
      });
    });
    
    // Обратная синхронизация (из других хранилищ в основное)
    syncStorages.forEach(storageType => {
      const keys = this._getKeysFromStorage(storageType);
      keys.forEach(key => {
        if (!mainKeys.includes(key)) {
          const value = this._getFromStorage(storageType, key);
          this.storage.set(key, value, { skipSync: true });
        }
      });
    });
  }
  
  /**
   * Проверка квот хранилищ
   * @private
   */
  _checkQuotas() {
    this.storageTypes.forEach(storageType => {
      const size = this._getStorageSize(storageType);
      const quota = this._getStorageQuota(storageType);
      
      if (size > quota * 0.9) {
        this._triggerEvent('quota-warning', {
          storageType,
          size,
          quota,
          usage: (size / quota * 100).toFixed(1)
        });
      }
    });
  }
  
  /**
   * Получение хранилищ для синхронизации
   * @private
   */
  _getSyncStorages() {
    return this.storageTypes.filter(type => 
      type !== this.options.storage.default && 
      this._isStorageAvailable(type)
    );
  }
  
  /**
   * Проверка доступности хранилища
   * @private
   */
  _isStorageAvailable(type) {
    try {
      if (type === 'cookie') return true;
      if (type === 'localStorage') return !!window.localStorage;
      if (type === 'sessionStorage') return !!window.sessionStorage;
      if (type === 'indexedDB') return !!window.indexedDB;
      return false;
    } catch (e) {
      return false;
    }
  }
  
  // =================================
  // Публичный API для работы с куки
  // =================================
  
  /**
   * Устанавливает куки
   * @param {string} name - Имя куки
   * @param {*} value - Значение
   * @param {Object} [options] - Дополнительные опции
   * @param {number} [options.days] - Срок действия в днях
   * @param {number} [options.hours] - Срок действия в часах
   * @param {number} [options.minutes] - Срок действия в минутах
   * @param {string} [options.domain] - Домен
   * @param {string} [options.path] - Путь
   * @param {boolean} [options.secure] - Флаг secure
   * @param {string} [options.sameSite] - SameSite атрибут
   */
  setCookie(name, value, options = {}) {
    const settings = { ...this.options.cookie, ...options };
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(JSON.stringify(value))}`;
    
    // Срок действия
    if (options.days || options.hours || options.minutes) {
      const date = new Date();
      if (options.days) date.setDate(date.getDate() + options.days);
      if (options.hours) date.setHours(date.getHours() + options.hours);
      if (options.minutes) date.setMinutes(date.getMinutes() + options.minutes);
      cookie += `; expires=${date.toUTCString()}`;
    }
    
    // Дополнительные параметры
    if (settings.domain) cookie += `; domain=${settings.domain}`;
    if (settings.path) cookie += `; path=${settings.path}`;
    if (settings.secure) cookie += '; secure';
    if (settings.sameSite) cookie += `; samesite=${settings.sameSite}`;
    
    document.cookie = cookie;
    
    // Обновление аналитики
    this.analyticsData.operations.set++;
    
    return true;
  }
  
  /**
   * Получает куки
   * @param {string} name - Имя куки
   * @returns {*} Значение куки
   */
  getCookie(name) {
    const nameEQ = encodeURIComponent(name) + '=';
    const cookies = document.cookie.split(';');
    
    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i];
      while (cookie.charAt(0) === ' ') cookie = cookie.substring(1);
      if (cookie.indexOf(nameEQ) === 0) {
        const value = decodeURIComponent(cookie.substring(nameEQ.length));
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Удаляет куки
   * @param {string} name - Имя куки
   */
  removeCookie(name) {
    this.setCookie(name, '', { days: -1 });
    
    // Обновление аналитики
    this.analyticsData.operations.remove++;
    
    return true;
  }
  
  /**
   * Получает все куки
   * @returns {Object} Все куки
   */
  getAllCookies() {
    const cookies = {};
    document.cookie.split(';').forEach(cookie => {
      const [name, value] = cookie.split('=').map(c => c.trim());
      if (name) {
        try {
          cookies[decodeURIComponent(name)] = JSON.parse(decodeURIComponent(value));
        } catch (e) {
          cookies[decodeURIComponent(name)] = decodeURIComponent(value);
        }
      }
    });
    return cookies;
  }
  
  // =====================================
  // Публичный API для работы с хранилищами
  // =====================================
  
  /**
   * Устанавливает значение в указанное хранилище
   * @param {string} storageType - Тип хранилища
   * @param {string} key - Ключ
   * @param {*} value - Значение
   * @param {Object} [options] - Дополнительные опции
   */
  setToStorage(storageType, key, value, options = {}) {
    return this._setToStorage(storageType, key, value, options);
  }
  
  /**
   * Получает значение из указанного хранилища
   * @param {string} storageType - Тип хранилища
   * @param {string} key - Ключ
   * @returns {*} Значение
   */
  getFromStorage(storageType, key) {
    return this._getFromStorage(storageType, key);
  }
  
  /**
   * Удаляет значение из указанного хранилища
   * @param {string} storageType - Тип хранилища
   * @param {string} key - Ключ
   */
  removeFromStorage(storageType, key) {
    return this._removeFromStorage(storageType, key);
  }
  
  /**
   * Получает все ключи из указанного хранилища
   * @param {string} storageType - Тип хранилища
   * @returns {string[]} Массив ключей
   */
  getKeysFromStorage(storageType) {
    return this._getKeysFromStorage(storageType);
  }
  
  /**
   * Очищает указанное хранилище
   * @param {string} storageType - Тип хранилища
   */
  clearStorage(storageType) {
    switch (storageType) {
      case 'cookie':
        const cookies = this.getAllCookies();
        Object.keys(cookies).forEach(name => this.removeCookie(name));
        break;
      case 'localStorage':
        window.localStorage.clear();
        break;
      case 'sessionStorage':
        window.sessionStorage.clear();
        break;
      case 'indexedDB':
        this._clearIndexedDB();
        break;
    }
  }
  
  // ===========================
  // Публичный API для аналитики
  // ===========================
  
  /**
   * Получает данные аналитики
   * @returns {Object} Данные аналитики
   */
  getAnalytics() {
    return {
      ...this.analyticsData,
      timestamp: Date.now()
    };
  }
  
  /**
   * Получает информацию о квотах
   * @returns {Object} Информация о квотах
   */
  getQuotaInfo() {
    const info = {};
    
    this.storageTypes.forEach(type => {
      info[type] = {
        size: this._getStorageSize(type),
        quota: this._getStorageQuota(type),
        usage: this._getStorageUsage(type)
      };
    });
    
    return info;
  }
  
  // ==========================
  // Публичный API для событий
  // ==========================
  
  /**
   * Подписывается на событие
   * @param {string} event - Имя события
   * @param {Function} callback - Функция обратного вызова
   */
  on(event, callback) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(callback);
  }
  
  /**
   * Отписывается от события
   * @param {string} event - Имя события
   * @param {Function} callback - Функция обратного вызова
   */
  off(event, callback) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(
        cb => cb !== callback
      );
    }
  }
  
  // =====================================
  // Приватные методы для работы с хранилищами
  // =====================================
  
  /**
   * Устанавливает значение в хранилище
   * @private
   */
  _setToStorage(storageType, key, value, options = {}) {
    try {
      switch (storageType) {
        case 'cookie':
          this.setCookie(key, value, options);
          break;
        case 'localStorage':
          window.localStorage.setItem(key, JSON.stringify(value));
          break;
        case 'sessionStorage':
          window.sessionStorage.setItem(key, JSON.stringify(value));
          break;
        case 'indexedDB':
          this._setToIndexedDB(key, value);
          break;
      }
      return true;
    } catch (e) {
      console.error(`VICook: Error setting to ${storageType}`, e);
      return false;
    }
  }
  
  /**
   * Получает значение из хранилища
   * @private
   */
  _getFromStorage(storageType, key) {
    try {
      switch (storageType) {
        case 'cookie':
          return this.getCookie(key);
        case 'localStorage':
          return JSON.parse(window.localStorage.getItem(key));
        case 'sessionStorage':
          return JSON.parse(window.sessionStorage.getItem(key));
        case 'indexedDB':
          return this._getFromIndexedDB(key);
        default:
          return null;
      }
    } catch (e) {
      console.error(`VICook: Error getting from ${storageType}`, e);
      return null;
    }
  }
  
  /**
   * Удаляет значение из хранилища
   * @private
   */
  _removeFromStorage(storageType, key) {
    try {
      switch (storageType) {
        case 'cookie':
          return this.removeCookie(key);
        case 'localStorage':
          return window.localStorage.removeItem(key);
        case 'sessionStorage':
          return window.sessionStorage.removeItem(key);
        case 'indexedDB':
          return this._removeFromIndexedDB(key);
        default:
          return false;
      }
    } catch (e) {
      console.error(`VICook: Error removing from ${storageType}`, e);
      return false;
    }
  }
  
  /**
   * Получает ключи из хранилища
   * @private
   */
  _getKeysFromStorage(storageType) {
    try {
      switch (storageType) {
        case 'cookie':
          return Object.keys(this.getAllCookies());
        case 'localStorage':
          return Object.keys(window.localStorage);
        case 'sessionStorage':
          return Object.keys(window.sessionStorage);
        case 'indexedDB':
          return this._getKeysFromIndexedDB();
        default:
          return [];
      }
    } catch (e) {
      console.error(`VICook: Error getting keys from ${storageType}`, e);
      return [];
    }
  }
  
  /**
   * Получает размер хранилища
   * @private
   */
  _getStorageSize(storageType) {
    try {
      switch (storageType) {
        case 'cookie':
          return encodeURIComponent(document.cookie).length;
        case 'localStorage':
          return JSON.stringify(window.localStorage).length;
        case 'sessionStorage':
          return JSON.stringify(window.sessionStorage).length;
        case 'indexedDB':
          return 0; // Размер IndexedDB сложно получить
        default:
          return 0;
      }
    } catch (e) {
      return 0;
    }
  }
  
  /**
   * Получает квоту хранилища
   * @private
   */
  _getStorageQuota(storageType) {
    // Приблизительные квоты
    switch (storageType) {
      case 'cookie':
        return 4096; // 4KB на домен
      case 'localStorage':
        return 5 * 1024 * 1024; // 5MB
      case 'sessionStorage':
        return 5 * 1024 * 1024; // 5MB
      case 'indexedDB':
        return 50 * 1024 * 1024; // 50MB
      default:
        return 0;
    }
  }
  
  /**
   * Получает процент использования хранилища
   * @private
   */
  _getStorageUsage(storageType) {
    const size = this._getStorageSize(storageType);
    const quota = this._getStorageQuota(storageType);
    return quota > 0 ? (size / quota * 100) : 0;
  }
  
  // =====================================
  // Методы для работы с IndexedDB
  // =====================================
  
  /**
   * Устанавливает значение в IndexedDB
   * @private
   */
  _setToIndexedDB(key, value) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('IndexedDB not initialized');
      
      const transaction = this.db.transaction(['keyValue'], 'readwrite');
      const store = transaction.objectStore('keyValue');
      const request = store.put({ key, value });
      
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  }
  
  /**
   * Получает значение из IndexedDB
   * @private
   */
  _getFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('IndexedDB not initialized');
      
      const transaction = this.db.transaction(['keyValue'], 'readonly');
      const store = transaction.objectStore('keyValue');
      const request = store.get(key);
      
      request.onsuccess = (event) => {
        resolve(event.target.result ? event.target.result.value : null);
      };
      
      request.onerror = (event) => reject(event.target.error);
    });
  }
  
  /**
   * Удаляет значение из IndexedDB
   * @private
   */
  _removeFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('IndexedDB not initialized');
      
      const transaction = this.db.transaction(['keyValue'], 'readwrite');
      const store = transaction.objectStore('keyValue');
      const request = store.delete(key);
      
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  }
  
  /**
   * Получает ключи из IndexedDB
   * @private
   */
  _getKeysFromIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('IndexedDB not initialized');
      
      const transaction = this.db.transaction(['keyValue'], 'readonly');
      const store = transaction.objectStore('keyValue');
      const request = store.getAllKeys();
      
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }
  
  /**
   * Очищает IndexedDB
   * @private
   */
  _clearIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('IndexedDB not initialized');
      
      const transaction = this.db.transaction(['keyValue'], 'readwrite');
      const store = transaction.objectStore('keyValue');
      const request = store.clear();
      
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  }
  
  /**
   * Генерирует событие
   * @private
   */
  _triggerEvent(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`VICook: Error in event handler for ${event}`, e);
        }
      });
    }
  }
}

// Экспорт плагина
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VICook;
} else if (typeof define === 'function' && define.amd) {
  define([], function() {
    return VICook;
  });
} else {
  window.VICook = VICook;
}