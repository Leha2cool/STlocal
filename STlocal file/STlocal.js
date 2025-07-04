/**
 * STlocal.js - Расширенная библиотека для управления localStorage
 * Версия: 2.1.0
 * Дата: 2025-07-04
 * GitHub: https://github.com/Leha2cool
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * Основные возможности:
 * - Пространства имен с вложенной структурой
 * - TTL (время жизни) для автоматического удаления данных
 * - Улучшенная система шифрования
 * - Мощная система событий
 * - Расширяемая архитектура плагинов
 * - Продвинутые операции с данными
 * - Мониторинг использования хранилища
 * - Синхронизация между вкладками
 * - Подробная обработка ошибок
 * - Валидация данных
 * - Кастомная сериализация
 */

class STlocal {
  /**
   * Создает новый экземпляр STlocal
   * @param {string} [namespace=''] - Префикс пространства имен для ключей
   * @param {Object} [options={}] - Настройки конфигурации
   * @param {number} [options.defaultTTL=null] - Время жизни по умолчанию (в секундах)
   * @param {string} [options.encryptionKey=null] - Ключ шифрования
   * @param {boolean} [options.autoCleanup=true] - Автоматическая очистка просроченных данных
   * @param {boolean} [options.crossTabSync=true] - Синхронизация между вкладками
   * @param {Function} [options.serializer=JSON.stringify] - Кастомный сериализатор
   * @param {Function} [options.deserializer=JSON.parse] - Кастомный десериализатор
   * @param {Function} [options.validator=null] - Функция валидации данных
   */
  constructor(namespace = '', options = {}) {
    this.namespace = namespace;
    this.defaultTTL = options.defaultTTL || null;
    this.encryptionKey = options.encryptionKey || null;
    this.autoCleanup = options.autoCleanup !== false;
    this.crossTabSync = options.crossTabSync !== false;
    this.serializer = options.serializer || JSON.stringify;
    this.deserializer = options.deserializer || JSON.parse;
    this.validator = options.validator || null;
    
    this.eventListeners = {};
    this.plugins = [];
    this.storageAvailable = false;
    this.cleanupInterval = null;
    
    // Инициализация библиотеки
    this._init();
  }
  
  // =====================
  // 1. Основной функционал
  // =====================
  
  /**
   * Сохраняет значение в localStorage
   * @param {string} key - Ключ для сохранения
   * @param {*} value - Значение для хранения
   * @param {Object} [options={}] - Дополнительные опции
   * @param {number} [options.ttl] - Время жизни в секундах
   * @param {boolean} [options.encrypt] - Принудительное шифрование
   * @param {boolean} [options.silent] - Пропуск событий
   * @returns {boolean} Успешность операции
   */
  set(key, value, options = {}) {
    if (!this.storageAvailable) return false;
    
    // Валидация данных
    if (this.validator && !this.validator(value, key)) {
      this._handleError(new Error('Валидация не пройдена'), 'set', key);
      return false;
    }
    
    const fullKey = this._prefixKey(key);
    const ttl = options.ttl !== undefined ? options.ttl : this.defaultTTL;
    const silent = !!options.silent;
    
    // Обработка плагинами
    const processed = this._runPlugins('beforeSet', { 
      key, 
      value, 
      options,
      operation: 'set'
    });
    
    const storageItem = {
      data: processed.value,
      meta: {
        created: Date.now(),
        expires: ttl ? Date.now() + ttl * 1000 : null,
        ttl,
        encryption: options.encrypt || this.encryptionKey ? true : false
      }
    };
    
    try {
      // Сериализация данных
      const serialized = this.serializer(storageItem);
      
      // Шифрование при необходимости
      const storageValue = this.encryptionKey || options.encrypt 
        ? this._encrypt(serialized)
        : serialized;
      
      localStorage.setItem(fullKey, storageValue);
      
      // Генерация событий (если не silent)
      if (!silent) {
        this._triggerEvent('change', key, value);
        this._triggerEvent(`change:${key}`, value);
      }
      
      // Обработка плагинами после сохранения
      this._runPlugins('afterSet', { 
        key, 
        value: processed.value, 
        options,
        operation: 'set'
      });
      
      return true;
    } catch (error) {
      this._handleError(error, 'set', key);
      return false;
    }
  }
  
  /**
   * Получает значение из localStorage
   * @param {string} key - Ключ для получения
   * @param {*} [defaultValue=null] - Значение по умолчанию
   * @param {Object} [options={}] - Дополнительные опции
   * @param {boolean} [options.skipExpiration] - Пропуск проверки срока действия
   * @returns {*} Полученное значение или значение по умолчанию
   */
  get(key, defaultValue = null, options = {}) {
    if (!this.storageAvailable) return defaultValue;
    
    const fullKey = this._prefixKey(key);
    const rawValue = localStorage.getItem(fullKey);
    
    if (rawValue === null) return defaultValue;
    
    try {
      // Обработка плагинами перед получением
      const processed = this._runPlugins('beforeGet', { 
        key, 
        rawValue, 
        options,
        operation: 'get'
      });
      
      // Расшифровка при необходимости
      let decryptedValue = processed.rawValue;
      let encrypted = false;
      
      // Проверка на зашифрованные данные
      if (processed.rawValue.startsWith('ENC:')) {
        const parts = processed.rawValue.split(':');
        if (parts.length > 1) {
          decryptedValue = this._decrypt(parts[1]);
          encrypted = true;
        }
      }
      
      // Десериализация данных
      let storageItem;
      try {
        storageItem = this.deserializer(decryptedValue);
      } catch (parseError) {
        // Обработка несериализованных значений
        storageItem = { data: decryptedValue, meta: {} };
      }
      
      // Проверка срока действия (если не пропущена)
      if (!options.skipExpiration && 
          storageItem.meta && 
          storageItem.meta.expires && 
          Date.now() > storageItem.meta.expires) {
        this.remove(key, { silent: true });
        return defaultValue;
      }
      
      // Обработка плагинами после получения
      const result = this._runPlugins('afterGet', { 
        key, 
        value: storageItem.data, 
        meta: storageItem.meta || {},
        options,
        operation: 'get'
      }).value;
      
      return result;
    } catch (error) {
      this._handleError(error, 'get', key);
      return defaultValue;
    }
  }
  
  /**
   * Удаляет ключ из localStorage
   * @param {string} key - Ключ для удаления
   * @param {Object} [options={}] - Дополнительные опции
   * @param {boolean} [options.silent] - Пропуск событий
   * @returns {boolean} Успешность операции
   */
  remove(key, options = {}) {
    if (!this.storageAvailable) return false;
    
    const fullKey = this._prefixKey(key);
    const silent = !!options.silent;
    const oldValue = this.get(key, undefined, { skipExpiration: true });
    
    try {
      localStorage.removeItem(fullKey);
      
      // Генерация событий (если не silent)
      if (!silent) {
        this._triggerEvent('remove', key, oldValue);
        this._triggerEvent(`remove:${key}`, oldValue);
      }
      
      return true;
    } catch (error) {
      this._handleError(error, 'remove', key);
      return false;
    }
  }
  
  /**
   * Очищает все данные в пространстве имен
   * @param {Object} [options={}] - Дополнительные опции
   * @param {boolean} [options.silent] - Пропуск событий
   * @returns {boolean} Успешность операции
   */
  clear(options = {}) {
    if (!this.storageAvailable) return false;
    
    const silent = !!options.silent;
    
    try {
      const keysToRemove = this.keys();
      
      if (this.namespace) {
        keysToRemove.forEach(key => this.remove(key, { silent: true }));
      } else {
        localStorage.clear();
      }
      
      // Генерация события (если не silent)
      if (!silent) {
        this._triggerEvent('clear');
      }
      
      return true;
    } catch (error) {
      this._handleError(error, 'clear');
      return false;
    }
  }
  
  /**
   * Проверяет существование ключа
   * @param {string} key - Ключ для проверки
   * @returns {boolean} Существует ли ключ
   */
  has(key) {
    return this.get(key) !== null;
  }
  
  /**
   * Получает все ключи в пространстве имен
   * @returns {string[]} Массив ключей
   */
  keys() {
    if (!this.storageAvailable) return [];
    
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (this._isNamespacedKey(key)) {
        keys.push(key.substring(this.namespace.length));
      }
    }
    return keys;
  }
  
  // ======================
  // 2. Расширенные операции
  // ======================
  
  /**
   * Частично обновляет объект
   * @param {string} key - Ключ для обновления
   * @param {Object} updates - Обновления для применения
   * @param {Object} [options] - Опции для операции set
   * @returns {boolean} Успешность операции
   */
  patch(key, updates, options = {}) {
    const currentValue = this.get(key, {});
    if (typeof currentValue !== 'object') return false;
    
    const newValue = { ...currentValue, ...updates };
    return this.set(key, newValue, options);
  }
  
  /**
   * Увеличивает числовое значение
   * @param {string} key - Ключ для увеличения
   * @param {number} [amount=1] - Величина увеличения
   * @param {Object} [options] - Опции для операции set
   * @returns {number|boolean} Новое значение или false при ошибке
   */
  increment(key, amount = 1, options = {}) {
    const currentValue = this.get(key, 0);
    if (typeof currentValue !== 'number') return false;
    
    const newValue = currentValue + amount;
    if (this.set(key, newValue, options)) {
      return newValue;
    }
    return false;
  }
  
  /**
   * Переключает булево значение
   * @param {string} key - Ключ для переключения
   * @param {Object} [options] - Опции для операции set
   * @returns {boolean|boolean} Новое значение или false при ошибке
   */
  toggle(key, options = {}) {
    const currentValue = this.get(key, false);
    if (typeof currentValue !== 'boolean') return false;
    
    const newValue = !currentValue;
    if (this.set(key, newValue, options)) {
      return newValue;
    }
    return false;
  }
  
  /**
   * Добавляет элементы в массив
   * @param {string} key - Ключ массива
   * @param {...*} items - Элементы для добавления
   * @param {Object} [options] - Опции для операции set
   * @returns {boolean} Успешность операции
   */
  push(key, ...items) {
    const array = this.get(key, []);
    if (!Array.isArray(array)) return false;
    
    array.push(...items);
    return this.set(key, array);
  }
  
  /**
   * Удаляет последний элемент из массива
   * @param {string} key - Ключ массива
   * @param {Object} [options] - Опции для операции set
   * @returns {*} Удаленный элемент или null
   */
  pop(key, options = {}) {
    const array = this.get(key, []);
    if (!Array.isArray(array)) return null;
    
    const item = array.pop();
    this.set(key, array, options);
    return item;
  }
  
  // =====================
  // 3. Управление TTL
  // =====================
  
  /**
   * Устанавливает TTL для существующего ключа
   * @param {string} key - Ключ для обновления
   * @param {number} ttl - Время жизни в секундах
   * @param {Object} [options] - Опции для операции set
   * @returns {boolean} Успешность операции
   */
  setTTL(key, ttl, options = {}) {
    const value = this.get(key, undefined, { skipExpiration: true });
    if (value === undefined) return false;
    
    return this.set(key, value, { ...options, ttl });
  }
  
  /**
   * Получает оставшееся время жизни ключа
   * @param {string} key - Ключ для проверки
   * @returns {number} Оставшееся время в миллисекундах
   */
  getRemainingTTL(key) {
    const fullKey = this._prefixKey(key);
    const rawValue = localStorage.getItem(fullKey);
    
    if (!rawValue) return 0;
    
    try {
      let decryptedValue = rawValue;
      
      // Обработка зашифрованных данных
      if (rawValue.startsWith('ENC:')) {
        const parts = rawValue.split(':');
        if (parts.length > 1) {
          decryptedValue = this._decrypt(parts[1]);
        }
      }
      
      const storageItem = this.deserializer(decryptedValue);
      
      if (!storageItem.meta || !storageItem.meta.expires) return Infinity;
      return Math.max(0, storageItem.meta.expires - Date.now());
    } catch {
      return 0;
    }
  }
  
  /**
   * Очищает просроченные элементы
   * @returns {number} Количество удаленных элементов
   */
  cleanupExpired() {
    if (!this.storageAvailable) return 0;
    
    let count = 0;
    const keys = this.keys();
    
    for (const key of keys) {
      const fullKey = this._prefixKey(key);
      const rawValue = localStorage.getItem(fullKey);
      
      if (rawValue) {
        try {
          let decryptedValue = rawValue;
          
          // Обработка зашифрованных данных
          if (rawValue.startsWith('ENC:')) {
            const parts = rawValue.split(':');
            if (parts.length > 1) {
              decryptedValue = this._decrypt(parts[1]);
            }
          }
          
          const storageItem = this.deserializer(decryptedValue);
          
          if (storageItem.meta && 
              storageItem.meta.expires && 
              Date.now() > storageItem.meta.expires) {
            this.remove(key, { silent: true });
            count++;
          }
        } catch (error) {
          this._handleError(error, 'cleanup', key);
        }
      }
    }
    
    if (count > 0) {
      this._triggerEvent('cleanup', count);
    }
    
    return count;
  }
  
  // =====================
  // 4. Групповые операции
  // =====================
  
  /**
   * Сохраняет несколько значений одновременно
   * @param {Object} items - Ключ-значение для сохранения
   * @param {Object} [options={}] - Опции для всех операций
   * @returns {Object} Результаты операций
   */
  setMany(items, options = {}) {
    const results = {};
    for (const [key, value] of Object.entries(items)) {
      results[key] = this.set(key, value, options);
    }
    return results;
  }
  
  /**
   * Получает несколько значений одновременно
   * @param {string[]} keys - Ключи для получения
   * @param {*} [defaultValue=null] - Значение по умолчанию
   * @returns {Object} Пары ключ-значение
   */
  getMany(keys, defaultValue = null) {
    const results = {};
    for (const key of keys) {
      results[key] = this.get(key, defaultValue);
    }
    return results;
  }
  
  /**
   * Удаляет несколько ключей одновременно
   * @param {string[]} keys - Ключи для удаления
   * @param {Object} [options={}] - Опции для операций
   * @returns {Object} Результаты операций
   */
  removeMany(keys, options = {}) {
    const results = {};
    for (const key of keys) {
      results[key] = this.remove(key, options);
    }
    return results;
  }
  
  // =====================
  // 5. Мониторинг и статистика
  // =====================
  
  /**
   * Получает размер данных
   * @param {string} [key=null] - Конкретный ключ или все данные
   * @returns {number} Размер в байтах
   */
  getSize(key = null) {
    if (!this.storageAvailable) return 0;
    
    if (key) {
      const value = localStorage.getItem(this._prefixKey(key));
      return value ? new Blob([value]).size : 0;
    }
    
    // Общий размер для пространства имен
    return this.keys().reduce((total, k) => {
      const value = localStorage.getItem(this._prefixKey(k));
      return total + new Blob([value]).size;
    }, 0);
  }
  
  /**
   * Получает статистику хранилища
   * @returns {Object} Статистика хранилища
   */
  getStats() {
    return {
      keys: this.keys().length,
      size: this.getSize(),
      available: this._getAvailableSpace(),
      quota: this._getStorageQuota()
    };
  }
  
  // =====================
  // 6. Резервное копирование
  // =====================
  
  /**
   * Экспортирует все данные в JSON
   * @param {Object} [options={}] - Опции экспорта
   * @param {boolean} [options.includeExpired] - Включать просроченные данные
   * @returns {string} JSON-представление данных
   */
  export(options = {}) {
    const data = {};
    const keys = this.keys();
    
    for (const key of keys) {
      const value = this.get(key, undefined, { 
        skipExpiration: options.includeExpired 
      });
      
      if (value !== undefined) {
        data[key] = value;
      }
    }
    
    return JSON.stringify(data);
  }
  
  /**
   * Импортирует данные из JSON
   * @param {string} backup - JSON-строка из export()
   * @param {Object} [options={}] - Опции импорта
   * @param {boolean} [options.merge] - Объединить с существующими данными
   * @param {boolean} [options.overwrite] - Перезаписать существующие ключи
   * @returns {boolean} Успешность операции
   */
  import(backup, options = {}) {
    try {
      const data = JSON.parse(backup);
      
      if (!options.merge) {
        this.clear({ silent: true });
      }
      
      for (const [key, value] of Object.entries(data)) {
        if (!options.overwrite && this.has(key)) {
          continue;
        }
        this.set(key, value, { silent: true });
      }
      
      this._triggerEvent('import', Object.keys(data).length);
      return true;
    } catch {
      return false;
    }
  }
  
  // =====================
  // 7. Система событий
  // =====================
  
  /**
   * Добавляет обработчик события
   * @param {string} event - Имя события
   * @param {Function} callback - Функция-обработчик
   * @returns {STlocal} Экземпляр для цепочки вызовов
   */
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
    return this;
  }
  
  /**
   * Удаляет обработчик события
   * @param {string} event - Имя события
   * @param {Function} [callback] - Конкретный обработчик
   * @returns {STlocal} Экземпляр для цепочки вызовов
   */
  off(event, callback) {
    if (!this.eventListeners[event]) return this;
    
    if (callback) {
      this.eventListeners[event] = this.eventListeners[event]
        .filter(cb => cb !== callback);
    } else {
      delete this.eventListeners[event];
    }
    return this;
  }
  
  /**
   * Отслеживает изменения ключа
   * @param {string} key - Ключ для отслеживания
   * @param {Function} callback - Функция обратного вызова
   * @param {number} [interval=500] - Интервал проверки (мс)
   * @returns {Function} Функция для остановки отслеживания
   */
  watch(key, callback, interval = 500) {
    let lastValue = this.get(key);
    const watchId = setInterval(() => {
      const currentValue = this.get(key);
      if (JSON.stringify(currentValue) !== JSON.stringify(lastValue)) {
        callback(currentValue, lastValue);
        lastValue = currentValue;
      }
    }, interval);
    
    return () => clearInterval(watchId);
  }
  
  // =====================
  // 8. Система плагинов
  // =====================
  
  /**
   * Подключает плагин
   * @param {Object|Function} plugin - Плагин для подключения
   * @returns {STlocal} Экземпляр для цепочки вызовов
   */
  use(plugin) {
    if (typeof plugin === 'function') {
      plugin(this);
      this.plugins.push(plugin);
    } else if (typeof plugin === 'object') {
      this.plugins.push(plugin);
      
      // Регистрация обработчиков событий из плагина
      if (plugin.events) {
        for (const [event, callback] of Object.entries(plugin.events)) {
          this.on(event, callback);
        }
      }
    }
    return this;
  }
  
  // =====================
  // 9. Безопасность
  // =====================
  
  /**
   * Устанавливает ключ шифрования
   * @param {string} key - Ключ шифрования
   * @returns {STlocal} Экземпляр для цепочки вызовов
   */
  encryptWith(key) {
    this.encryptionKey = key;
    return this;
  }
  
  // =====================
  // Вспомогательные методы
  // =====================
  
  /**
   * Создает экземпляр с пространством имен
   * @param {string} ns - Пространство имен
   * @param {Object} [options={}] - Настройки для нового экземпляра
   * @returns {STlocal} Новый экземпляр
   */
  namespace(ns, options = {}) {
    return new STlocal(`${this.namespace}${ns}`, {
      ...options,
      defaultTTL: this.defaultTTL,
      encryptionKey: this.encryptionKey
    });
  }
  
  // =====================
  // Приватные методы
  // =====================
  
  /** Инициализирует экземпляр */
  _init() {
    // Проверка доступности хранилища
    this.storageAvailable = this._checkStorageSupport();
    
    // Автоматическая очистка при инициализации
    if (this.autoCleanup) {
      this.cleanupExpired();
      // Регулярная очистка
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpired();
      }, 60 * 1000); // Каждую минуту
    }
    
    // Синхронизация между вкладками
    if (this.storageAvailable && this.crossTabSync) {
      window.addEventListener('storage', this._handleStorageEvent.bind(this));
    }
  }
  
  /** Проверяет доступность localStorage */
  _checkStorageSupport() {
    try {
      const testKey = '__stlocal_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  /** Добавляет префикс пространства имен к ключу */
  _prefixKey(key) {
    return `${this.namespace}${key}`;
  }
  
  /** Проверяет принадлежность ключа пространству имен */
  _isNamespacedKey(key) {
    return this.namespace ? key.startsWith(this.namespace) : true;
  }
  
  /** Шифрует данные */
  _encrypt(data) {
    if (!this.encryptionKey) return data;
    
    try {
      let result = '';
      for (let i = 0; i < data.length; i++) {
        const charCode = data.charCodeAt(i) ^ 
          this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
        result += String.fromCharCode(charCode);
      }
      return 'ENC:' + btoa(result);
    } catch (e) {
      return data;
    }
  }
  
  /** Дешифрует данные */
  _decrypt(data) {
    if (!this.encryptionKey) return data;
    
    try {
      const decoded = atob(data);
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ 
          this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
        result += String.fromCharCode(charCode);
      }
      return result;
    } catch (e) {
      return data;
    }
  }
  
  /** Оценивает доступное пространство */
  _getAvailableSpace() {
    if (!this.storageAvailable) return 0;
    
    try {
      const testKey = '__stlocal_space_test__';
      let data = '';
      
      // Заполняем хранилище до лимита
      for (let i = 0; i < 100; i++) {
        data += new Array(10240).join('x'); // 10KB
        try {
          localStorage.setItem(testKey, data);
        } catch (e) {
          localStorage.removeItem(testKey);
          return data.length - 10240;
        }
      }
      
      localStorage.removeItem(testKey);
      return data.length;
    } catch (e) {
      return 0;
    }
  }
  
  /** Получает квоту хранилища */
  _getStorageQuota() {
    return 5 * 1024 * 1024; // Стандартная квота 5MB
  }
  
  /** Генерирует события */
  _triggerEvent(event, ...args) {
    if (this.eventListeners[event]) {
      // Копия обработчиков для безопасного выполнения
      const listeners = [...this.eventListeners[event]];
      for (const cb of listeners) {
        try {
          cb(...args);
        } catch (e) {
          this._handleError(e, 'event', event);
        }
      }
    }
  }
  
  /** Обрабатывает события хранилища из других вкладок */
  _handleStorageEvent(event) {
    if (!event.key || !this._isNamespacedKey(event.key)) return;
    
    const key = event.key.substring(this.namespace.length);
    
    if (event.newValue === null) {
      // Событие удаления
      this._triggerEvent('remove', key, event.oldValue);
      this._triggerEvent(`remove:${key}`, event.oldValue);
    } else if (event.newValue !== event.oldValue) {
      // Событие изменения
      try {
        const newValue = this.get(key);
        this._triggerEvent('change', key, newValue, event.oldValue);
        this._triggerEvent(`change:${key}`, newValue, event.oldValue);
      } catch (e) {
        // Игнорируем ошибки
      }
    }
  }
  
  /** Выполняет плагины для конкретного хука */
  _runPlugins(hook, data) {
    let result = { ...data };
    for (const plugin of this.plugins) {
      if (plugin.hooks && typeof plugin.hooks[hook] === 'function') {
        const newResult = plugin.hooks[hook](result);
        if (newResult) {
          result = newResult;
        }
      }
    }
    return result;
  }
  
  /** Обрабатывает и сообщает об ошибках */
  _handleError(error, operation, key = null) {
    const errorInfo = {
      operation,
      key,
      error: error.message,
      namespace: this.namespace,
      timestamp: Date.now()
    };
    
    this._triggerEvent('error', errorInfo);
  }
}

// Экспорт класса
if (typeof module !== 'undefined' && module.exports) {
  module.exports = STlocal;
} else if (typeof define === 'function' && define.amd) {
  define([], function() {
    return STlocal;
  });
} else {
  window.STlocal = STlocal;
}