### Документация для плагина LASTkeep.js (v1.5.0)

LASTkeep.js — расширение для STlocal.js, добавляющее функции аналитики хранилища, сжатия данных и контроля доступа. Плагин оптимизирует работу с хранилищем, обеспечивает безопасность и предоставляет детальную статистику использования.

---

#### **1. Установка**
```html
<script scr="https://cdn.jsdelivr.net/gh/Leha2cool/STlocal.js@main/Plugins/LASTkeep.js"><script>
```

---

#### **2. Конфигурация**
```javascript
const options = {
  compression: {
    enabled: true,      // Включить сжатие
    algorithm: 'lz',    // 'lz', 'base64', 'none'
    minSize: 100        // Минимальная длина для сжатия (символы)
  },
  analytics: {
    enabled: true,      // Сбор аналитики
    trackFrequency: true, // Отслеживать частоту обращений
    trackSizeChanges: true, // Запись истории размера
    saveInterval: 60000 // Интервал автосохранения (мс)
  },
  accessControl: {
    enabled: true,      // Контроль доступа
    defaultRole: 'user', // Роль по умолчанию
    roles: {            // Кастомные роли
      admin: { read: true, write: true, delete: true },
      user: { read: true, write: true, delete: false }
    }
  }
};
```

---

#### **3. Основные методы API**

##### **Инициализация**
```javascript
keeper.init(storage: STlocal): void
```
- **storage**: Экземпляр STlocal.js
- **Обязателен** для работы плагина.

---

##### **Управление ролями**
```javascript
// Добавить роль
keeper.addRole(role: string, permissions: {
  read: boolean,
  write: boolean,
  delete: boolean
}): void

// Удалить роль
keeper.removeRole(role: string): void
```
Пример:
```javascript
keeper.addRole('moderator', { read: true, write: true, delete: false });
```

---

##### **Управление правами для ключей**
```javascript
keeper.setKeyPermissions(key: string, permissions: {
  read: boolean,
  write: boolean,
  delete: boolean
}): void
```
Устанавливает особые права для ключа (хранится в `key_permissions:key`).

---

##### **Сбор статистики**
```javascript
// Общая статистика
const stats = keeper.getStats(): {
  operations: { get: number, set: number, remove: number },
  totalKeys: number,
  sizeHistory: Array<{ timestamp: number, size: number }>
}

// Топ ключей по обращениям
const topKeys = keeper.getKeyAccessFrequency(limit: number = 10): Array<{
  key: string,
  count: number
}>
```

---

##### **Оптимизация хранилища**
```javascript
// Сжать все подходящие данные
const compressedCount = await keeper.compressAll(): Promise<number>

// Комплексная оптимизация
const result = await keeper.optimizeStorage(options: {
  sizeThreshold?: number,   // Макс. размер (байт)
  accessThreshold?: number  // Мин. обращения для сохранения
}): Promise<{
  compressed: number,
  removed: number,
  totalBefore: number,
  totalAfter: number
}>
```

---

##### **Генерация отчета**
```javascript
const report = keeper.generateReport(): {
  summary: {
    totalKeys: number,
    totalSize: number,
    sizeChange: number,
    compressionRatio: number
  },
  operations: { /* проценты операций */ },
  topKeys: Array<{ key: string, count: number }>,
  recommendations: Array<{
    type: 'cleanup' | 'compression' | 'security',
    message: string,
    severity: 'low' | 'medium' | 'high'
  }>
}
```

---

##### **Деинициализация**
```javascript
keeper.destroy(): void
```
Останавливает сбор аналитики и сохраняет данные.

---

#### **4. Интеграция с STlocal.js**
Плагин автоматически добавляет хуки для операций:
- `set`: Сжатие данных, проверка прав записи.
- `get`: Распаковка данных, проверка прав чтения.
- `remove`: Проверка прав удаления.

**Пример с ролью:**
```javascript
// Запись с проверкой роли
storage.set('data', { ... }, { role: 'admin' });

// Чтение с проверкой роли
storage.get('data', null, { role: 'user' });
```

---

#### **5. Алгоритмы сжатия**
- **LZ (по умолчанию)**: Эффективен для текста с повторениями.
- **Base64**: Для бинарных данных или короткого текста.
- **Отключение**: `algorithm: 'none'`.

> Примечание: Сжимаются только строки длиннее `minSize`.

---

#### **6. Аналитика**
Данные сохраняются в хранилище каждые 60 сек (ключ `LASTkeep_analytics`):
```json
{
  "operations": { "get": 42, "set": 12, "remove": 3 },
  "keyAccess": { "user_data": 28, "config": 15 },
  "sizeHistory": [
    { "timestamp": 1720245600000, "size": 24576 }
  ]
}
```

---

#### **7. Примеры использования**

**Оптимизация при превышении лимита:**
```javascript
// При достижении 5 МБ удалить ключи с < 5 обращений
await keeper.optimizeStorage({
  sizeThreshold: 5 * 1024 * 1024,
  accessThreshold: 5
});
```

**Отчет для администратора:**
```javascript
setInterval(() => {
  const report = keeper.generateReport();
  if (report.recommendations.some(r => r.severity === 'high')) {
    alert('Storage critical!');
  }
}, 86400000); // Ежедневно
```

**Кастомные права для ключа:**
```javascript
keeper.setKeyPermissions('audit_log', {
  read: false,
  write: true,
  delete: false
});
```

---

#### **8. Ограничения**
- Системные ключи (начинаются с `system_`) доступны только роли `admin`.
- Сжатие применяется только к строкам.
- История размеров хранится до 1000 записей.

---

#### **9. Совместимость**
- Требует STlocal.js v3.0+
- Поддерживает браузеры: Chrome 58+, Firefox 55+, Safari 12+.

---

[GitHub](https://github.com/Leha2cool) | [Документация STlocal.js](https://stlocal-docs.ru)  
© 2025, Алексей Фролов (Leha2cool)
