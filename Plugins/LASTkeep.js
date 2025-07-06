/**
 * LASTkeep.js - Плагин для STlocal.js
 * Версия: 1.6.0
 * Дата: 2025-07-06
 * GitHub: https://github.com/Leha2cool
 * 
 * Комбинирует функции:
 * - Аналитики хранилища
 * - Сжатия данных
 * - Контроля доступа
 */
class LASTkeep {
  constructor(options = {}) {
    // Настройки по умолчанию
    this.defaultOptions = {
      compression: {
        enabled: true,
        algorithm: 'lz', // lz, base64, none
        minSize: 100 // минимальный размер для сжатия (символов)
      },
      analytics: {
        enabled: true,
        trackFrequency: true,
        trackSizeChanges: true,
        saveInterval: 60000 // интервал сохранения аналитики (мс)
      },
      accessControl: {
        enabled: true,
        defaultRole: 'user',
        roles: {
          admin: { read: true, write: true, delete: true },
          user: { read: true, write: true, delete: false },
          guest: { read: true, write: false, delete: false }
        }
      }
    };
    
    // Слияние пользовательских настроек
    this.options = { 
      ...this.defaultOptions, 
      ...options,
      compression: { 
        ...this.defaultOptions.compression, 
        ...(options.compression || {}) 
      },
      analytics: { 
        ...this.defaultOptions.analytics, 
        ...(options.analytics || {}) 
      },
      accessControl: { 
        ...this.defaultOptions.accessControl, 
        ...(options.accessControl || {}) 
      }
    };
    
    this.storage = null;
    this.analyticsData = {
      operations: { get: 0, set: 0, remove: 0 },
      keyAccess: {},
      sizeHistory: []
    };
    this.analyticsTimer = null;
  }
  
  /**
   * Инициализация плагина
   * @param {Object} storage - Экземпляр STlocal
   */
  init(storage) {
    if (!storage || typeof storage.get !== 'function') {
      throw new Error('Invalid storage instance provided');
    }
    
    this.storage = storage;
    
    // Загрузка сохраненных аналитических данных
    if (this.options.analytics.enabled) {
      const savedData = this.storage.get('LASTkeep_analytics');
      if (savedData && typeof savedData === 'object') {
        this.analyticsData = savedData;
      }
      
      // Запуск периодического сохранения
      this._startAnalytics();
    }
    
    // Регистрация обработчиков
    this._registerHooks();
    
    // Начальная запись статистики
    this._recordSize();
    
    return this;
  }
  
  /**
   * Запуск системы аналитики
   * @private
   */
  _startAnalytics() {
    // Остановка предыдущего таймера
    if (this.analyticsTimer) {
      clearInterval(this.analyticsTimer);
    }
    
    // Запуск нового таймера
    if (this.options.analytics.enabled) {
      this.analyticsTimer = setInterval(() => {
        this._recordSize();
        this._saveAnalytics();
      }, this.options.analytics.saveInterval);
    }
  }
  
  /**
   * Регистрация хуков
   * @private
   */
  _registerHooks() {
    if (!this.storage || typeof this.storage.use !== 'function') {
      console.warn('Storage instance does not support hooks');
      return;
    }
    
    this.storage.use({
      hooks: {
        beforeSet: this._beforeSet.bind(this),
        afterSet: this._afterSet.bind(this),
        beforeGet: this._beforeGet.bind(this),
        afterGet: this._afterGet.bind(this),
        beforeRemove: this._beforeRemove.bind(this),
        afterRemove: this._afterRemove.bind(this)
      }
    });
  }
  
  /**
   * Хук перед сохранением данных
   * @private
   */
  _beforeSet({ key, value, options = {} }) {
    // Проверка прав доступа
    if (this.options.accessControl.enabled) {
      const role = options.role || this.options.accessControl.defaultRole;
      if (!this._checkPermission(role, 'write', key)) {
        throw new Error(`Access denied for write operation on key: ${key}`);
      }
    }
    
    // Сжатие данных
    if (this.options.compression.enabled && 
        this._shouldCompress(value)) {
      return { 
        key, 
        value: this._compress(value), 
        options: { ...options, compressed: true } 
      };
    }
    
    return { key, value, options };
  }
  
  /**
   * Хук после сохранения данных
   * @private
   */
  _afterSet({ key }) {
    // Обновление аналитики
    if (this.options.analytics.enabled) {
      this.analyticsData.operations.set++;
      
      if (this.options.analytics.trackFrequency) {
        this.analyticsData.keyAccess[key] = 
          (this.analyticsData.keyAccess[key] || 0) + 1;
      }
      
      this._recordSize();
      this._saveAnalytics();
    }
  }
  
  /**
   * Хук перед получением данных
   * @private
   */
  _beforeGet({ key, options = {} }) {
    // Проверка прав доступа
    if (this.options.accessControl.enabled) {
      const role = options.role || this.options.accessControl.defaultRole;
      if (!this._checkPermission(role, 'read', key)) {
        throw new Error(`Access denied for read operation on key: ${key}`);
      }
    }
    
    return { key, options };
  }
  
  /**
   * Хук после получения данных
   * @private
   */
  _afterGet({ key, value, meta = {} }) {
    let result = value;
    
    // Распаковка данных
    if (meta.compressed) {
      try {
        result = this._decompress(value);
      } catch (error) {
        console.error(`Decompression error for key ${key}:`, error);
      }
    }
    
    // Обновление аналитики
    if (this.options.analytics.enabled) {
      this.analyticsData.operations.get++;
      
      if (this.options.analytics.trackFrequency) {
        this.analyticsData.keyAccess[key] = 
          (this.analyticsData.keyAccess[key] || 0) + 1;
      }
    }
    
    return { key, value: result, meta };
  }
  
  /**
   * Хук перед удалением данных
   * @private
   */
  _beforeRemove({ key, options = {} }) {
    // Проверка прав доступа
    if (this.options.accessControl.enabled) {
      const role = options.role || this.options.accessControl.defaultRole;
      if (!this._checkPermission(role, 'delete', key)) {
        throw new Error(`Access denied for delete operation on key: ${key}`);
      }
    }
    
    return { key, options };
  }
  
  /**
   * Хук после удаления данных
   * @private
   */
  _afterRemove({ key }) {
    // Обновление аналитики
    if (this.options.analytics.enabled) {
      this.analyticsData.operations.remove++;
      
      if (this.options.analytics.trackFrequency) {
        delete this.analyticsData.keyAccess[key];
      }
      
      this._recordSize();
      this._saveAnalytics();
    }
  }
  
  /**
   * Проверка прав доступа
   * @private
   */
  _checkPermission(role, action, key) {
    // Получение конфигурации роли
    const roleConfig = this.options.accessControl.roles[role];
    if (!roleConfig) return false;
    
    // Специальные права для системных ключей
    if (key.startsWith('system_') && role !== 'admin') {
      return false;
    }
    
    // Проверка пермиссий
    return roleConfig[action] === true;
  }
  
  /**
   * Определение необходимости сжатия
   * @private
   */
  _shouldCompress(value) {
    // Сжатие только для строк
    if (typeof value !== 'string') return false;
    
    // Проверка минимального размера
    if (this.options.compression.minSize > 0) {
      return value.length >= this.options.compression.minSize;
    }
    
    return true;
  }
  
  /**
   * Сжатие данных
   * @private
   */
  _compress(data) {
    switch (this.options.compression.algorithm) {
      case 'lz':
        return this._lzCompress(data);
      case 'base64':
        return this._base64Compress(data);
      default:
        return data;
    }
  }
  
  /**
   * Распаковка данных
   * @private
   */
  _decompress(data) {
    switch (this.options.compression.algorithm) {
      case 'lz':
        return this._lzDecompress(data);
      case 'base64':
        return this._base64Decompress(data);
      default:
        return data;
    }
  }
  
  /**
   * Сжатие LZ
   * @private
   */
  _lzCompress(data) {
    if (!data) return '';
    
    let result = '';
    let dict = {};
    let current = '';
    
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      const next = current + char;
      
      if (dict[next] !== undefined) {
        current = next;
      } else {
        if (current.length > 1) {
          result += String.fromCharCode(dict[current]);
        } else {
          result += current;
        }
        
        dict[next] = Object.keys(dict).length + 256;
        current = char;
      }
    }
    
    if (current.length > 1) {
      result += String.fromCharCode(dict[current]);
    } else {
      result += current;
    }
    
    return result;
  }
  
  /**
   * Распаковка LZ
   * @private
   */
  _lzDecompress(data) {
    if (!data) return '';
    
    let result = '';
    let dict = {};
    let current = '';
    let nextCode = 256;
    
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      let entry = '';
      
      if (char.charCodeAt(0) < 256) {
        entry = char;
      } else {
        const code = char.charCodeAt(0);
        entry = dict[code] || (current + current[0]);
      }
      
      result += entry;
      
      if (current && nextCode < 65536) {
        dict[nextCode] = current + entry[0];
        nextCode++;
      }
      
      current = entry;
    }
    
    return result;
  }
  
  /**
   * Сжатие Base64
   * @private
   */
  _base64Compress(data) {
    return btoa(unescape(encodeURIComponent(data)));
  }
  
  /**
   * Распаковка Base64
   * @private
   */
  _base64Decompress(data) {
    return decodeURIComponent(escape(atob(data)));
  }
  
  /**
   * Запись текущего размера хранилища
   * @private
   */
  _recordSize() {
    if (!this.options.analytics.enabled || 
        !this.options.analytics.trackSizeChanges ||
        !this.storage.getSize) return;
    
    const size = this.storage.getSize();
    this.analyticsData.sizeHistory.push({
      timestamp: Date.now(),
      size
    });
    
    // Ограничение истории до 1000 записей
    if (this.analyticsData.sizeHistory.length > 1000) {
      this.analyticsData.sizeHistory.shift();
    }
  }
  
  /**
   * Сохранение аналитических данных
   * @private
   */
  _saveAnalytics() {
    if (!this.storage.set) return;
    
    this.storage.set('LASTkeep_analytics', this.analyticsData, {
      ttl: 60 * 60 * 24 * 30 // 30 дней
    });
  }
  
  // =====================
  // Публичные методы API
  // =====================
  
  /**
   * Получение статистики использования
   * @returns {Object} Статистика
   */
  getStats() {
    return {
      operations: { ...this.analyticsData.operations },
      totalKeys: Object.keys(this.analyticsData.keyAccess).length,
      sizeHistory: [...this.analyticsData.sizeHistory],
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Получение частоты доступа к ключам
   * @param {number} [limit=10] - Количество ключей для возврата
   * @returns {Array} Массив ключей с частотой доступа
   */
  getKeyAccessFrequency(limit = 10) {
    return Object.entries(this.analyticsData.keyAccess)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, count]) => ({ key, count }));
  }
  
  /**
   * Добавление новой роли
   * @param {string} role - Название роли
   * @param {Object} permissions - Права доступа {read, write, delete}
   */
  addRole(role, permissions) {
    this.options.accessControl.roles[role] = permissions;
  }
  
  /**
   * Удаление роли
   * @param {string} role - Название роли
   */
  removeRole(role) {
    delete this.options.accessControl.roles[role];
  }
  
  /**
   * Установка прав доступа для ключа
   * @param {string} key - Ключ данных
   * @param {Object} permissions - Права доступа
   */
  setKeyPermissions(key, permissions) {
    if (!this.storage.set) return;
    
    this.storage.set(`key_permissions:${key}`, permissions, {
      ttl: 60 * 60 * 24 // 24 часа
    });
  }
  
  /**
   * Сжатие всех данных в хранилище
   * @async
   * @returns {Promise<number>} Количество сжатых ключей
   */
  async compressAll() {
    if (!this.options.compression.enabled || 
        !this.storage.keys || 
        !this.storage.get || 
        !this.storage.set) return 0;
    
    let compressedCount = 0;
    const keys = this.storage.keys();
    
    for (const key of keys) {
      // Пропускаем системные ключи
      if (key === 'LASTkeep_analytics' || key.startsWith('key_permissions:')) {
        continue;
      }
      
      const value = this.storage.get(key);
      
      if (this._shouldCompress(value)) {
        this.storage.set(key, value, { 
          compressed: true,
          role: 'system' // Системная операция
        });
        compressedCount++;
      }
    }
    
    return compressedCount;
  }
  
  /**
   * Оптимизация хранилища
   * @async
   * @param {Object} [options] - Опции оптимизации
   * @param {number} [options.sizeThreshold] - Максимальный размер хранилища
   * @param {number} [options.accessThreshold] - Порог обращения к ключу
   * @returns {Promise<Object>} Результаты оптимизации
   */
  async optimizeStorage(options = {}) {
    const result = {
      compressed: 0,
      removed: 0,
      totalBefore: this.storage.getSize ? this.storage.getSize() : 0,
      keysBefore: this.storage.keys ? this.storage.keys().length : 0
    };
    
    // Сжатие данных
    if (this.options.compression.enabled) {
      result.compressed = await this.compressAll();
    }
    
    // Удаление редко используемых данных
    if (options.accessThreshold && this.storage.keys && this.storage.remove) {
      const keys = this.storage.keys();
      
      for (const key of keys) {
        // Пропускаем системные ключи
        if (key === 'LASTkeep_analytics' || key.startsWith('key_permissions:')) {
          continue;
        }
        
        const accessCount = this.analyticsData.keyAccess[key] || 0;
        if (accessCount < options.accessThreshold) {
          this.storage.remove(key);
          result.removed++;
        }
      }
    }
    
    // Удаление по размеру
    if (options.sizeThreshold && this.storage.getSize) {
      const currentSize = this.storage.getSize();
      if (currentSize > options.sizeThreshold) {
        const infrequentKeys = this.getKeyAccessFrequency(Infinity)
          .filter(item => item.count < (options.accessThreshold || 0))
          .map(item => item.key);
        
        for (const key of infrequentKeys) {
          // Пропускаем системные ключи
          if (key === 'LASTkeep_analytics' || key.startsWith('key_permissions:')) {
            continue;
          }
          
          this.storage.remove(key);
          result.removed++;
          
          if (this.storage.getSize() <= options.sizeThreshold) {
            break;
          }
        }
      }
    }
    
    result.totalAfter = this.storage.getSize ? this.storage.getSize() : 0;
    result.keysAfter = this.storage.keys ? this.storage.keys().length : 0;
    
    return result;
  }
  
  /**
   * Генерация отчета об использовании хранилища
   * @returns {Object} Отчет
   */
  generateReport() {
    const stats = this.getStats();
    const sizeHistory = stats.sizeHistory;
    
    // Расчет изменения размера
    const sizeChange = sizeHistory.length > 1
      ? sizeHistory[sizeHistory.length - 1].size - sizeHistory[0].size
      : 0;
    
    // Самые популярные ключи
    const topKeys = this.getKeyAccessFrequency(5);
    
    // Распределение по типам операций
    const totalOperations = stats.operations.get + 
                           stats.operations.set + 
                           stats.operations.remove;
    
    return {
      summary: {
        totalKeys: stats.totalKeys,
        totalSize: this.storage.getSize ? this.storage.getSize() : 0,
        totalOperations,
        sizeChange,
        compressionRatio: this._calculateCompressionRatio()
      },
      operations: {
        get: {
          count: stats.operations.get,
          percentage: totalOperations > 0 
            ? Math.round((stats.operations.get / totalOperations) * 100) 
            : 0
        },
        set: {
          count: stats.operations.set,
          percentage: totalOperations > 0 
            ? Math.round((stats.operations.set / totalOperations) * 100) 
            : 0
        },
        remove: {
          count: stats.operations.remove,
          percentage: totalOperations > 0 
            ? Math.round((stats.operations.remove / totalOperations) * 100) 
            : 0
        }
      },
      topKeys,
      recommendations: this._generateRecommendations()
    };
  }
  
  /**
   * Расчет эффективности сжатия
   * @private
   */
  _calculateCompressionRatio() {
    if (!this.options.compression.enabled || 
        !this.storage.keys || 
        !this.storage.get) return 1;
    
    const compressedKeys = this.storage.keys().filter(key => {
      const meta = this.storage.getMeta ? this.storage.getMeta(key) : null;
      return meta && meta.compressed;
    });
    
    if (compressedKeys.length === 0) return 1;
    
    let originalSize = 0;
    let compressedSize = 0;
    
    for (const key of compressedKeys) {
      const value = this.storage.get(key);
      const rawValue = this.storage.get(key, null, { skipDecompression: true });
      
      originalSize += value.length;
      compressedSize += rawValue.length;
    }
    
    return originalSize > 0 ? compressedSize / originalSize : 1;
  }
  
  /**
   * Генерация рекомендаций
   * @private
   */
  _generateRecommendations() {
    const recommendations = [];
    const stats = this.getStats();
    const sizeHistory = stats.sizeHistory;
    
    // Рекомендация по очистке
    if (sizeHistory.length > 10) {
      const lastSize = sizeHistory[sizeHistory.length - 1].size;
      const avgSize = sizeHistory.reduce((sum, item) => sum + item.size, 0) / sizeHistory.length;
      
      if (lastSize > avgSize * 1.5) {
        recommendations.push({
          type: 'cleanup',
          message: 'Storage size significantly exceeds average values. Cleanup recommended.',
          severity: 'high'
        });
      }
    }
    
    // Рекомендация по сжатию
    const compressionRatio = this._calculateCompressionRatio();
    if (compressionRatio > 0.8 && this.options.compression.enabled) {
      recommendations.push({
        type: 'compression',
        message: `Low compression efficiency (ratio ${compressionRatio.toFixed(2)}). Try different algorithm.`,
        severity: 'medium'
      });
    }
    
    // Рекомендация по безопасности
    if (this.storage.keys) {
      const adminKeys = this.storage.keys().filter(key => 
        this._checkPermission('admin', 'read', key) &&
        !this._checkPermission('user', 'read', key)
      );
      
      if (adminKeys.length > 0) {
        recommendations.push({
          type: 'security',
          message: `Found ${adminKeys.length} keys with elevated access rights. Review permissions.`,
          severity: 'low'
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Остановка плагина и очистка ресурсов
   */
  destroy() {
    // Остановка таймера аналитики
    if (this.analyticsTimer) {
      clearInterval(this.analyticsTimer);
      this.analyticsTimer = null;
    }
    
    // Сохранение финальных аналитических данных
    if (this.options.analytics.enabled) {
      this._saveAnalytics();
    }
  }
}

// Экспорт плагина
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LASTkeep;
} else if (typeof define === 'function' && define.amd) {
  define([], function() {
    return LASTkeep;
  });
} else {
  window.LASTkeep = LASTkeep;
}