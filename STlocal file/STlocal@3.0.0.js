/**
 * STlocal.js - Продвинутая библиотека для работы с localStorage
 * Версия: 3.0.0
 * Дата: 2025-07-04
 * GitHub: https://github.com/Leha2cool
 */

class STlocal {
  constructor(namespace = '', options = {}) {
    this.namespace = namespace;
    this.namespaceSeparator = options.namespaceSeparator || ':';
    this.defaultTTL = options.defaultTTL || null;
    this.encryptionKey = options.encryptionKey || null;
    this.autoCleanup = options.autoCleanup !== false;
    this.crossTabSync = options.crossTabSync !== false;
    this.storageType = options.storageType || 'local';
    this.serializer = options.serializer || this._defaultSerializer;
    this.deserializer = options.deserializer || this._defaultDeserializer;
    this.validator = options.validator || null;
    this.cryptoEngine = options.cryptoEngine || 'simple';
    
    this.eventListeners = {};
    this.plugins = [];
    this.storageAvailable = false;
    this.cleanupInterval = null;
    this.watchers = {};
    
    this._init();
  }

  // =====================
  // 1. Основные методы
  // =====================
  
  set(key, value, options = {}) {
    if (!this.storageAvailable) return false;
    
    if (this.validator && !this.validator(value, key)) {
      this._handleError(new Error('Validation failed'), 'set', key);
      return false;
    }
    
    const fullKey = this._prefixKey(key);
    const ttl = options.ttl !== undefined ? options.ttl : this.defaultTTL;
    const silent = !!options.silent;
    const shouldEncrypt = options.encrypt !== undefined ? options.encrypt : !!this.encryptionKey;
    
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
        encryption: shouldEncrypt
      }
    };
    
    try {
      const serialized = this.serializer(storageItem);
      const storageValue = shouldEncrypt 
        ? 'ENC:' + this._encrypt(serialized) 
        : serialized;
      
      this._getStorage().setItem(fullKey, storageValue);
      
      if (!silent) {
        this._triggerEvent('change', key, value);
        this._triggerEvent(`change:${key}`, value);
        this._notifyWatchers(key, value);
      }
      
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
  
  get(key, defaultValue = null, options = {}) {
    if (!this.storageAvailable) return defaultValue;
    
    const fullKey = this._prefixKey(key);
    const rawValue = this._getStorage().getItem(fullKey);
    
    if (rawValue === null) return defaultValue;
    
    try {
      const processed = this._runPlugins('beforeGet', { 
        key, 
        rawValue, 
        options,
        operation: 'get'
      });
      
      let decryptedValue = processed.rawValue;
      
      if (processed.rawValue.startsWith('ENC:')) {
        decryptedValue = this._decrypt(processed.rawValue.substring(4));
      }
      
      let storageItem;
      try {
        storageItem = this.deserializer(decryptedValue);
      } catch {
        storageItem = { data: decryptedValue, meta: {} };
      }
      
      if (!options.skipExpiration && 
          storageItem.meta?.expires && 
          Date.now() > storageItem.meta.expires) {
        this.remove(key, { silent: true });
        return defaultValue;
      }
      
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
  
  remove(key, options = {}) {
    if (!this.storageAvailable) return false;
    
    const fullKey = this._prefixKey(key);
    const silent = !!options.silent;
    const oldValue = this.get(key, undefined, { skipExpiration: true });
    
    try {
      this._getStorage().removeItem(fullKey);
      
      if (!silent) {
        this._triggerEvent('remove', key, oldValue);
        this._triggerEvent(`remove:${key}`, oldValue);
        this._notifyWatchers(key, null, oldValue);
      }
      
      return true;
    } catch (error) {
      this._handleError(error, 'remove', key);
      return false;
    }
  }
  
  clear(options = {}) {
    if (!this.storageAvailable) return false;
    
    const silent = !!options.silent;
    
    try {
      const keysToRemove = this.keys();
      
      if (this.namespace) {
        keysToRemove.forEach(key => this.remove(key, { silent: true }));
      } else {
        this._getStorage().clear();
      }
      
      if (!silent) {
        this._triggerEvent('clear');
      }
      
      return true;
    } catch (error) {
      this._handleError(error, 'clear');
      return false;
    }
  }
  
  has(key) {
    return this.get(key) !== null;
  }
  
  keys() {
    if (!this.storageAvailable) return [];
    
    const keys = [];
    const prefix = this._prefixKey('');
    
    for (let i = 0; i < this._getStorage().length; i++) {
      const key = this._getStorage().key(i);
      if (key.startsWith(prefix)) {
        keys.push(key.substring(prefix.length));
      }
    }
    return keys;
  }
  
  // ======================
  // 2. Расширенные операции
  // ======================
  
  patch(key, updates, options = {}) {
    const currentValue = this.get(key, {});
    if (typeof currentValue !== 'object' || currentValue === null) return false;
    return this.set(key, { ...currentValue, ...updates }, options);
  }
  
  increment(key, amount = 1, options = {}) {
    const currentValue = this.get(key, 0);
    if (typeof currentValue !== 'number') return false;
    
    const newValue = currentValue + amount;
    return this.set(key, newValue, options) ? newValue : false;
  }
  
  decrement(key, amount = 1, options = {}) {
    return this.increment(key, -amount, options);
  }
  
  toggle(key, options = {}) {
    const currentValue = this.get(key, false);
    if (typeof currentValue !== 'boolean') return false;
    
    const newValue = !currentValue;
    return this.set(key, newValue, options) ? newValue : false;
  }
  
  push(key, ...items) {
    const array = this.get(key, []);
    if (!Array.isArray(array)) return false;
    
    const newArray = [...array, ...items];
    return this.set(key, newArray);
  }
  
  pop(key, options = {}) {
    const array = this.get(key, []);
    if (!Array.isArray(array) || array.length === 0) return null;
    
    const newArray = [...array];
    const item = newArray.pop();
    return this.set(key, newArray, options) ? item : null;
  }
  
  shift(key, options = {}) {
    const array = this.get(key, []);
    if (!Array.isArray(array) || array.length === 0) return null;
    
    const newArray = [...array];
    const item = newArray.shift();
    return this.set(key, newArray, options) ? item : null;
  }
  
  unshift(key, ...items) {
    const array = this.get(key, []);
    if (!Array.isArray(array)) return false;
    
    const newArray = [...items, ...array];
    return this.set(key, newArray);
  }
  
  // =====================
  // 3. Управление TTL
  // =====================
  
  setTTL(key, ttl, options = {}) {
    const value = this.get(key, undefined, { skipExpiration: true });
    if (value === undefined) return false;
    return this.set(key, value, { ...options, ttl });
  }
  
  getRemainingTTL(key) {
    if (!this.storageAvailable) return 0;
    
    const fullKey = this._prefixKey(key);
    const rawValue = this._getStorage().getItem(fullKey);
    
    if (!rawValue) return 0;
    
    try {
      let value = rawValue;
      if (rawValue.startsWith('ENC:')) {
        value = this._decrypt(rawValue.substring(4));
      }
      
      const storageItem = this.deserializer(value);
      if (!storageItem.meta?.expires) return Infinity;
      
      const remaining = storageItem.meta.expires - Date.now();
      return Math.max(0, remaining);
    } catch {
      return 0;
    }
  }
  
  getExpirationDate(key) {
    const remaining = this.getRemainingTTL(key);
    return remaining > 0 ? new Date(Date.now() + remaining) : null;
  }
  
  cleanupExpired() {
    if (!this.storageAvailable) return 0;
    
    let count = 0;
    const keys = this.keys();
    
    keys.forEach(key => {
      if (this.getRemainingTTL(key) === 0) {
        this.remove(key, { silent: true });
        count++;
      }
    });
    
    if (count > 0) {
      this._triggerEvent('cleanup', count);
    }
    
    return count;
  }
  
  // =====================
  // 4. Групповые операции
  // =====================
  
  setMany(items, options = {}) {
    const results = {};
    Object.entries(items).forEach(([key, value]) => {
      results[key] = this.set(key, value, options);
    });
    return results;
  }
  
  getMany(keys, defaultValue = null) {
    const results = {};
    keys.forEach(key => {
      results[key] = this.get(key, defaultValue);
    });
    return results;
  }
  
  removeMany(keys, options = {}) {
    const results = {};
    keys.forEach(key => {
      results[key] = this.remove(key, options);
    });
    return results;
  }
  
  transaction(operations) {
    try {
      const results = {};
      
      if (operations.set) {
        results.set = this.setMany(operations.set, { silent: true });
      }
      
      if (operations.remove) {
        results.remove = this.removeMany(operations.remove, { silent: true });
      }
      
      this._triggerEvent('transaction', operations, results);
      return results;
    } catch (error) {
      this._handleError(error, 'transaction');
      return false;
    }
  }
  
  // =====================
  // 5. Мониторинг и статистика
  // =====================
  
  getSize(key = null) {
    if (!this.storageAvailable) return 0;
    
    if (key) {
      const value = this._getStorage().getItem(this._prefixKey(key));
      return value ? new Blob([value]).size : 0;
    }
    
    return this.keys().reduce((total, k) => {
      const value = this._getStorage().getItem(this._prefixKey(k));
      return total + (value ? new Blob([value]).size : 0);
    }, 0);
  }
  
  getStats() {
    return {
      keys: this.keys().length,
      size: this.getSize(),
      available: this._getAvailableSpace(),
      quota: this._getStorageQuota(),
      namespace: this.namespace,
      storageType: this.storageType
    };
  }
  
  // =====================
  // 6. Резервное копирование
  // =====================
  
  export(options = {}) {
    const data = {};
    this.keys().forEach(key => {
      const value = this.get(key, undefined, { 
        skipExpiration: options.includeExpired 
      });
      if (value !== undefined) {
        data[key] = value;
      }
    });
    return JSON.stringify(data);
  }
  
  import(backup, options = {}) {
    try {
      const data = JSON.parse(backup);
      
      if (!options.merge) {
        this.clear({ silent: true });
      }
      
      Object.entries(data).forEach(([key, value]) => {
        if (options.overwrite || !this.has(key)) {
          this.set(key, value, { silent: true });
        }
      });
      
      this._triggerEvent('import', Object.keys(data).length);
      return true;
    } catch {
      return false;
    }
  }
  
  // =====================
  // 7. Система событий
  // =====================
  
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
    return this;
  }
  
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
  
  watch(key, callback, interval = 500) {
    if (!this.watchers[key]) {
      this.watchers[key] = [];
    }
    
    const watcher = {
      callback,
      interval,
      lastValue: this.get(key),
      timer: setInterval(() => {
        const currentValue = this.get(key);
        if (JSON.stringify(currentValue) !== JSON.stringify(watcher.lastValue)) {
          callback(currentValue, watcher.lastValue);
          watcher.lastValue = currentValue;
        }
      }, interval)
    };
    
    this.watchers[key].push(watcher);
    
    return () => {
      clearInterval(watcher.timer);
      this.watchers[key] = this.watchers[key].filter(w => w !== watcher);
    };
  }
  
  // =====================
  // 8. Система плагинов
  // =====================
  
  use(plugin) {
    if (typeof plugin === 'function') {
      plugin(this);
    } else if (typeof plugin === 'object') {
      this.plugins.push(plugin);
      
      if (plugin.events) {
        Object.entries(plugin.events).forEach(([event, callback]) => {
          this.on(event, callback);
        });
      }
      
      if (typeof plugin.init === 'function') {
        plugin.init(this);
      }
    }
    return this;
  }
  
  // =====================
  // 9. Безопасность
  // =====================
  
  encryptWith(key) {
    this.encryptionKey = key;
    return this;
  }
  
  setCryptoEngine(engine) {
    if (['simple', 'aes'].includes(engine)) {
      this.cryptoEngine = engine;
    }
    return this;
  }
  
  // =====================
  // 10. Пространства имен
  // =====================
  
  namespace(ns, options = {}) {
    return new STlocal(
      `${this.namespace}${this.namespaceSeparator}${ns}`, 
      {
        ...options,
        namespaceSeparator: this.namespaceSeparator,
        defaultTTL: this.defaultTTL,
        encryptionKey: this.encryptionKey,
        storageType: this.storageType
      }
    );
  }
  
  // =====================
  // 11. Управление хранилищем
  // =====================
  
  setStorageType(type) {
    if (['local', 'session'].includes(type)) {
      this.storageType = type;
      return true;
    }
    return false;
  }
  
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.storageAvailable && this.crossTabSync) {
      window.removeEventListener('storage', this._handleStorageEvent);
    }
    
    Object.values(this.watchers).forEach(watchers => {
      watchers.forEach(watcher => clearInterval(watcher.timer));
    });
    
    this.eventListeners = {};
    this.plugins = [];
    this.watchers = {};
  }
  
  // =====================
  // Приватные методы
  // =====================
  
  _init() {
    this.storageAvailable = this._checkStorageSupport();
    
    if (this.autoCleanup) {
      this.cleanupExpired();
      this.cleanupInterval = setInterval(
        () => this.cleanupExpired(), 
        60 * 1000
      );
    }
    
    if (this.storageAvailable && this.crossTabSync) {
      window.addEventListener('storage', this._handleStorageEvent.bind(this));
    }
  }
  
  _getStorage() {
    return this.storageType === 'session' 
      ? sessionStorage 
      : localStorage;
  }
  
  _checkStorageSupport() {
    try {
      const testKey = '__stlocal_test__';
      const storage = this._getStorage();
      storage.setItem(testKey, testKey);
      storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
  
  _prefixKey(key) {
    return this.namespace 
      ? `${this.namespace}${this.namespaceSeparator}${key}`
      : key;
  }
  
  _defaultSerializer(value) {
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Set) return JSON.stringify([...value]);
    if (value instanceof Map) return JSON.stringify([...value]);
    if (value instanceof RegExp) return value.toString();
    return JSON.stringify(value);
  }
  
  _defaultDeserializer(value) {
    try {
      const parsed = JSON.parse(value);
      
      // Восстановление специальных типов
      if (parsed && typeof parsed === 'object') {
        if (parsed.__type === 'Date' && parsed.value) {
          return new Date(parsed.value);
        }
        if (parsed.__type === 'Set' && Array.isArray(parsed.value)) {
          return new Set(parsed.value);
        }
        if (parsed.__type === 'Map' && Array.isArray(parsed.value)) {
          return new Map(parsed.value);
        }
        if (parsed.__type === 'RegExp' && parsed.value) {
          return new RegExp(parsed.value.pattern, parsed.value.flags);
        }
      }
      
      return parsed;
    } catch {
      return value;
    }
  }
  
  _encrypt(data) {
    if (!this.encryptionKey) return data;
    
    try {
      if (this.cryptoEngine === 'aes' && window.crypto && window.crypto.subtle) {
        return this._aesEncrypt(data);
      }
      
      // Простое шифрование XOR
      let result = '';
      for (let i = 0; i < data.length; i++) {
        const charCode = data.charCodeAt(i) ^ 
          this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
        result += String.fromCharCode(charCode);
      }
      return btoa(result);
    } catch {
      return data;
    }
  }
  
  async _aesEncrypt(data) {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const keyBuffer = encoder.encode(this.encryptionKey.padEnd(32, ' ').slice(0, 32));
      
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-CBC' },
        false,
        ['encrypt']
      );
      
      const iv = window.crypto.getRandomValues(new Uint8Array(16));
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-CBC', iv },
        cryptoKey,
        dataBuffer
      );
      
      const encryptedBuffer = new Uint8Array(encrypted);
      const result = new Uint8Array(iv.length + encryptedBuffer.length);
      result.set(iv);
      result.set(encryptedBuffer, iv.length);
      
      return btoa(String.fromCharCode(...result));
    } catch {
      return data;
    }
  }
  
  _decrypt(data) {
    if (!this.encryptionKey) return data;
    
    try {
      if (this.cryptoEngine === 'aes' && window.crypto && window.crypto.subtle) {
        return this._aesDecrypt(data);
      }
      
      // Простое дешифрование XOR
      const decoded = atob(data);
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ 
          this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
        result += String.fromCharCode(charCode);
      }
      return result;
    } catch {
      return data;
    }
  }
  
  async _aesDecrypt(data) {
    try {
      const decoder = new TextDecoder();
      const encryptedBuffer = Uint8Array.from(atob(data), c => c.charCodeAt(0));
      const iv = encryptedBuffer.slice(0, 16);
      const dataBuffer = encryptedBuffer.slice(16);
      
      const encoder = new TextEncoder();
      const keyBuffer = encoder.encode(this.encryptionKey.padEnd(32, ' ').slice(0, 32));
      
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-CBC' },
        false,
        ['decrypt']
      );
      
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-CBC', iv },
        cryptoKey,
        dataBuffer
      );
      
      return decoder.decode(decrypted);
    } catch {
      return data;
    }
  }
  
  _getAvailableSpace() {
    if (!this.storageAvailable) return 0;
    
    try {
      const testKey = '__stlocal_space_test__';
      let data = '';
      let savedSize = 0;
      const storage = this._getStorage();
      
      for (let i = 0; i < 100; i++) {
        data += '0'.repeat(1024);
        try {
          storage.setItem(testKey, data);
          savedSize = data.length;
        } catch {
          break;
        }
      }
      
      storage.removeItem(testKey);
      return savedSize;
    } catch {
      return 0;
    }
  }
  
  _getStorageQuota() {
    return this.storageType === 'session' 
      ? 5 * 1024 * 1024  // 5MB для sessionStorage
      : 10 * 1024 * 1024; // 10MB для localStorage
  }
  
  _triggerEvent(event, ...args) {
    const listeners = this.eventListeners[event];
    if (listeners) {
      // Выполняем копию массива на случай изменений во время выполнения
      [...listeners].forEach(cb => {
        try {
          cb(...args);
        } catch (e) {
          this._handleError(e, 'event', event);
        }
      });
    }
  }
  
  _handleStorageEvent(event) {
    if (!event.key || !event.key.startsWith(this._prefixKey(''))) return;
    
    const prefix = this._prefixKey('');
    const key = event.key.substring(prefix.length);
    
    if (event.newValue === null) {
      this._triggerEvent('remove', key, event.oldValue);
      this._triggerEvent(`remove:${key}`, event.oldValue);
      this._notifyWatchers(key, null, event.oldValue);
    } else if (event.newValue !== event.oldValue) {
      try {
        const value = this.get(key);
        this._triggerEvent('change', key, value, event.oldValue);
        this._triggerEvent(`change:${key}`, value, event.oldValue);
        this._notifyWatchers(key, value, event.oldValue);
      } catch {}
    }
  }
  
  _notifyWatchers(key, newValue, oldValue) {
    if (this.watchers[key]) {
      this.watchers[key].forEach(watcher => {
        watcher.lastValue = newValue;
        watcher.callback(newValue, oldValue);
      });
    }
  }
  
  _runPlugins(hook, data) {
    let result = { ...data };
    
    this.plugins.forEach(plugin => {
      if (plugin.hooks?.[hook]) {
        const newResult = plugin.hooks[hook](result);
        if (newResult !== undefined) {
          result = newResult;
        }
      }
    });
    
    return result;
  }
  
  _handleError(error, operation, key = null) {
    const errorInfo = {
      operation,
      key,
      error: error.message,
      namespace: this.namespace,
      storageType: this.storageType,
      timestamp: Date.now()
    };
    
    this._triggerEvent('error', errorInfo);
  }
}

// Экспорт для различных сред
if (typeof module !== 'undefined' && module.exports) {
  module.exports = STlocal;
} else if (typeof define === 'function' && define.amd) {
  define([], () => STlocal);
} else {
  window.STlocal = STlocal;
}