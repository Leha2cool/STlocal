/**
 * LASTkeep.js - Плагин для STlocal.js
 * Версия: 1.4.0
 * Дата: 2025-07-04
 * GitHub: https://github.com/Leha2cool
 *
 *
 *
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
        algorithm: 'lz', // lz, gzip, none
        minSize: 100 // минимальный размер для сжатия (байт)
      },
      analytics: {
        enabled: true,
        trackFrequency: true,
        trackSizeChanges: true
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
    this.options = { ...this.defaultOptions, ...options };
    this.storage = null;
    this.analyticsData = {
      operations: { get: 0, set: 0, remove: 0 },
      keyAccess: {},
      sizeHistory: []
    };
  }
  
  /**
   * Инициализация плагина
   * @param {STlocal} storage - Экземпляр STlocal
   */
  init(storage) {
    this.storage = storage;
    
    // Инициализация аналитики
    if (this.options.analytics.enabled) {
      this._initAnalytics();
    }
    
    // Регистрация обработчиков
    this._registerHooks();
    
    // Начальная запись статистики
    this._recordSize();
  }
  
  /**
   * Инициализация системы аналитики
   * @private
   */
  _initAnalytics() {
    // Периодическая запись размера хранилища
    setInterval(() => this._recordSize(), 60000); // Каждую минуту
    
    // Сохранение аналитических данных
    this.storage.on('change:LASTkeep_analytics', (data) => {
      this.analyticsData = data;
    });
    
    // Восстановление данных при наличии
    const savedData = this.storage.get('LASTkeep_analytics');
    if (savedData) {
      this.analyticsData = savedData;
    }
  }
  
  /**
   * Регистрация хуков
   * @private
   */
  _registerHooks() {
    this.storage.use({
      hooks: {
        beforeSet: this._beforeSet.bind(this),
        afterSet: this._afterSet.bind(this),
        beforeGet: this._beforeGet.bind(this),
        afterGet: this._afterGet.bind(this),
        beforeRemove: this._beforeRemove.bind(this)
      }
    });
  }
  
  /**
   * Хук перед сохранением данных
   * @private
   */
  _beforeSet({ key, value, options }) {
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
  _afterSet({ key, value, options }) {
    // Обновление аналитики
    if (this.options.analytics.enabled) {
      this.analyticsData.operations.set++;
      
      if (this.options.analytics.trackFrequency) {
        this.analyticsData.keyAccess[key] = 
          (this.analyticsData.keyAccess[key] || 0) + 1;
      }
    }
  }
  
  /**
   * Хук перед получением данных
   * @private
   */
  _beforeGet({ key, options }) {
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
  _afterGet({ key, value, meta }) {
    // Распаковка данных
    if (meta && meta.compressed) {
      value = this._decompress(value);
    }
    
    // Обновление аналитики
    if (this.options.analytics.enabled) {
      this.analyticsData.operations.get++;
      
      if (this.options.analytics.trackFrequency) {
        this.analyticsData.keyAccess[key] = 
          (this.analyticsData.keyAccess[key] || 0) + 1;
      }
    }
    
    return { key, value, meta };
  }
  
  /**
   * Хук перед удалением данных
   * @private
   */
  _beforeRemove({ key, options }) {
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
   * Проверка прав доступа
   * @private
   */
  _checkPermission(role, action, key) {
    const roleConfig = this.options.accessControl.roles[role];
    if (!roleConfig) return false;
    
    // Специальные права для системных ключей
    if (key.startsWith('system_') && role !== 'admin') {
      return false;
    }
    
    return roleConfig[action] === true;
  }
  
  /**
   * Определение необходимости сжатия
   * @private
   */
  _shouldCompress(value) {
    if (typeof value !== 'string') return false;
    
    if (this.options.compression.minSize > 0) {
      const size = new Blob([value]).size;
      return size >= this.options.compression.minSize;
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
      case 'gzip':
        return this._gzipCompress(data);
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
      case 'gzip':
        return this._gzipDecompress(data);
      default:
        return data;
    }
  }
  
  /**
   * Сжатие LZ
   * @private
   */
  _lzCompress(data) {
    // Упрощенная реализация LZ-сжатия
    let result = '';
    let dict = {};
    let current = '';
    
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      const next = current + char;
      
      if (dict[next] !== undefined) {
        current = next;
      } else {
        result += dict[current] || current;
        dict[next] = Object.keys(dict).length + 256;
        current = char;
      }
    }
    
    result += dict[current] || current;
    return result;
  }
  
  /**
   * Распаковка LZ
   * @private
   */
  _lzDecompress(data) {
    // Упрощенная реализация LZ-распаковки
    let result = '';
    let dict = {};
    let current = '';
    let nextCode = 256;
    
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      let entry;
      
      if (char.charCodeAt(0) < 256) {
        entry = char;
      } else {
        entry = dict[char.charCodeAt(0)] || current + current[0];
      }
      
      result += entry;
      
      if (current) {
        dict[nextCode++] = current + entry[0];
      }
      
      current = entry;
    }
    
    return result;
  }
  
  /**
   * Сжатие GZIP (упрощенное)
   * @private
   */
  _gzipCompress(data) {
    // В реальной реализации следует использовать более эффективные алгоритмы
    return btoa(encodeURIComponent(data).replace(/%../g, (match) => {
      return String.fromCharCode(parseInt(match.replace(/%/, ''), 16);
    }));
  }
  
  /**
   * Распаковка GZIP (упрощенная)
   * @private
   */
  _gzipDecompress(data) {
    return decodeURIComponent(Array.from(atob(data)).map(char => {
      return '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  }
  
  /**
   * Запись текущего размера хранилища
   * @private
   */
  _recordSize() {
    if (!this.options.analytics.trackSizeChanges) return;
    
    const size = this.storage.getSize();
    this.analyticsData.sizeHistory.push({
      timestamp: Date.now(),
      size
    });
    
    // Сохранение данных аналитики
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
      sizeHistory: [...this.analyticsData.sizeHistory]
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
   * @param {Object} permissions - Права доступа
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
    if (!this.options.compression.enabled) return 0;
    
    let compressedCount = 0;
    const keys = this.storage.keys();
    
    for (const key of keys) {
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
      totalBefore: this.storage.getSize(),
      keysBefore: this.storage.keys().length
    };
    
    // Сжатие данных
    if (this.options.compression.enabled) {
      result.compressed = await this.compressAll();
    }
    
    // Удаление редко используемых данных
    if (options.accessThreshold) {
      const keys = this.storage.keys();
      
      for (const key of keys) {
        const accessCount = this.analyticsData.keyAccess[key] || 0;
        if (accessCount < options.accessThreshold) {
          this.storage.remove(key);
          result.removed++;
        }
      }
    }
    
    // Удаление по размеру
    if (options.sizeThreshold) {
      const currentSize = this.storage.getSize();
      if (currentSize > options.sizeThreshold) {
        const keys = this.getKeyAccessFrequency();
        
        for (const { key } of keys) {
          this.storage.remove(key);
          result.removed++;
          
          if (this.storage.getSize() <= options.sizeThreshold) {
            break;
          }
        }
      }
    }
    
    result.totalAfter = this.storage.getSize();
    result.keysAfter = this.storage.keys().length;
    
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
        totalSize: this.storage.getSize(),
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
  
  // =====================
  // Вспомогательные методы
  // =====================
  
  /**
   * Расчет эффективности сжатия
   * @private
   */
  _calculateCompressionRatio() {
    if (!this.options.compression.enabled) return 1;
    
    const compressedKeys = this.storage.keys().filter(key => {
      const meta = this.storage.getMeta(key);
      return meta && meta.compressed;
    });
    
    if (compressedKeys.length === 0) return 1;
    
    let originalSize = 0;
    let compressedSize = 0;
    
    for (const key of compressedKeys) {
      const value = this.storage.get(key, null, { skipDecompression: true });
      const decompressed = this._decompress(value);
      
      originalSize += new Blob([decompressed]).size;
      compressedSize += new Blob([value]).size;
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
          message: 'Размер хранилища значительно превышает средние значения. Рекомендуется очистить неиспользуемые данные.'
        });
      }
    }
    
    // Рекомендация по сжатию
    const compressionRatio = this._calculateCompressionRatio();
    if (compressionRatio > 0.8 && this.options.compression.enabled) {
      recommendations.push({
        type: 'compression',
        message: `Эффективность сжатия низкая (коэффициент ${compressionRatio.toFixed(2)}). Попробуйте другой алгоритм сжатия.`
      });
    }
    
    // Рекомендация по безопасности
    const adminKeys = this.storage.keys().filter(key => 
      this._checkPermission('admin', 'read', key) &&
      !this._checkPermission('user', 'read', key)
    );
    
    if (adminKeys.length > 0) {
      recommendations.push({
        type: 'security',
        message: `Обнаружены ${adminKeys.length} ключей с повышенными правами доступа. Убедитесь в необходимости таких ограничений.`
      });
    }
    
    return recommendations;
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