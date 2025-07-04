# Плагин LASTkeep.js для STlocal.js

**LASTkeep** (Local Advanced Storage Toolkit with Keep-alive features, Enhanced Efficiency & Performance) - это мощный плагин, расширяющий функционал библиотеки STlocal.js. Он объединяет три ключевые возможности: аналитику хранилища, сжатие данных и контроль доступа, предоставляя комплексное решение для профессиональной работы с localStorage.

## Основные возможности

### 1. Аналитика хранилища
- **Мониторинг операций**: Точный учет операций чтения/записи/удаления
- **Частота доступа**: Определение самых популярных ключей
- **История размеров**: Отслеживание изменения размера хранилища во времени
- **Визуализация данных**: Генерация отчетов с графиками и рекомендациями
- **Профилирование**: Анализ эффективности использования хранилища

### 2. Сжатие данных
- **Алгоритмы сжатия**: Поддержка LZ и GZIP (упрощенные реализации)
- **Адаптивное сжатие**: Автоматическое определение необходимости сжатия
- **Пакетная обработка**: Массовое сжатие всех данных одним вызовом
- **Прозрачная работа**: Автоматическое сжатие/распаковка без участия пользователя
- **Расчет эффективности**: Статистика коэффициента сжатия

### 3. Контроль доступа
- **Ролевая модель**: Гибкая система ролей (admin, user, guest)
- **Права доступа**: Тонкая настройка прав для каждой операции
- **Ключевые политики**: Специальные права для системных ключей
- **Динамическое управление**: Добавление/удаление ролей в реальном времени
- **Защита данных**: Предотвращение несанкционированного доступа

## Документация

### Инициализация плагина

```javascript
const storage = new STlocal('app_');
const lastkeep = new LASTkeep({
  compression: {
    enabled: true,
    algorithm: 'lz', // 'lz' или 'gzip'
    minSize: 100     // минимальный размер данных для сжатия (байт)
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
});

storage.use(lastkeep);
```

### Методы аналитики

#### `getStats()`
Возвращает общую статистику операций

**Возвращает:**
```typescript
{
  operations: {
    get: number,   // количество операций чтения
    set: number,   // количество операций записи
    remove: number // количество операций удаления
  },
  totalKeys: number, // общее количество ключей
  sizeHistory: Array<{ timestamp: number, size: number }> // история изменений размера
}
```

#### `getKeyAccessFrequency(limit = 10)`
Возвращает список ключей, отсортированный по частоте доступа

**Параметры:**
- `limit` - количество возвращаемых ключей (по умолчанию 10)

**Возвращает:**
```typescript
Array<{ key: string, count: number }>
```

#### `generateReport()`
Генерирует подробный отчет об использовании хранилища

**Возвращает:**
```typescript
{
  summary: {
    totalKeys: number,
    totalSize: number,
    totalOperations: number,
    sizeChange: number, // изменение размера за период
    compressionRatio: number // коэффициент сжатия
  },
  operations: {
    get: { count: number, percentage: number },
    set: { count: number, percentage: number },
    remove: { count: number, percentage: number }
  },
  topKeys: Array<{ key: string, count: number }>, // топ ключей по частоте доступа
  recommendations: Array<{ type: string, message: string }> // рекомендации
}
```

### Методы сжатия данных

#### `compressAll()`
Применяет сжатие ко всем данным в хранилище, которые соответствуют условиям сжатия

**Возвращает:**
`Promise<number>` - количество сжатых ключей

#### `optimizeStorage(options)`
Выполняет оптимизацию хранилища: сжатие данных и удаление неиспользуемых ключей

**Параметры:**
```typescript
{
  sizeThreshold?: number,   // максимальный допустимый размер хранилища (байт)
  accessThreshold?: number  // минимальное количество обращений для сохранения ключа
}
```

**Возвращает:**
```typescript
Promise<{
  compressed: number,    // количество сжатых ключей
  removed: number,       // количество удаленных ключей
  totalBefore: number,   // общий размер до оптимизации
  totalAfter: number,    // общий размер после оптимизации
  keysBefore: number,    // количество ключей до оптимизации
  keysAfter: number      // количество ключей после оптимизации
}>
```

### Методы контроля доступа

#### `addRole(role, permissions)`
Добавляет новую роль

**Параметры:**
- `role` - название роли
- `permissions` - объект с разрешениями:
  ```typescript
  { read: boolean, write: boolean, delete: boolean }
  ```

#### `removeRole(role)`
Удаляет роль

**Параметры:**
- `role` - название роли для удаления

#### `setKeyPermissions(key, permissions)`
Устанавливает особые разрешения для конкретного ключа

**Параметры:**
- `key` - ключ данных
- `permissions` - объект разрешений (как в addRole)

## Примеры использования

### Использование контроля доступа
```javascript
// Сохраняем данные с указанием роли
storage.set('user_data', { name: 'Alice' }, { role: 'user' });

// Пытаемся удалить данные с ролью 'guest' (будет ошибка доступа)
try {
  storage.remove('user_data', { role: 'guest' });
} catch (error) {
  console.error(error.message); // "Access denied for delete operation on key: user_data"
}

// Добавляем новую роль
lastkeep.addRole('editor', {
  read: true,
  write: true,
  delete: false
});

// Устанавливаем особые права для ключа
lastkeep.setKeyPermissions('admin_settings', {
  read: false,
  write: true,
  delete: false
});
```

### Работа со сжатием данных
```javascript
// Сохраняем большой массив данных
const largeData = new Array(10000).fill({ value: Math.random() });
storage.set('big_data', largeData);

// Принудительно сжимаем все данные
lastkeep.compressAll().then(count => {
  console.log(`Сжато ${count} ключей`);
  
  // Оптимизируем хранилище
  lastkeep.optimizeStorage({
    sizeThreshold: 500 * 1024, // 500KB
    accessThreshold: 5         // удалить ключи с < 5 обращений
  }).then(result => {
    console.log(`Освобождено ${result.totalBefore - result.totalAfter} байт`);
  });
});
```

### Аналитика и отчеты
```javascript
// Получаем статистику
const stats = lastkeep.getStats();
console.log('Всего операций записи:', stats.operations.set);

// Получаем самые популярные ключи
const topKeys = lastkeep.getKeyAccessFrequency(5);
console.log('Топ-5 ключей:', topKeys);

// Генерируем полный отчет
const report = lastkeep.generateReport();
console.log('Отчет об использовании хранилища:', report);

// Выводим рекомендации
report.recommendations.forEach(rec => {
  console.log(`[${rec.type}] ${rec.message}`);
});
```

## Рекомендации по использованию

1. **Для больших данных** используйте алгоритм `gzip` для лучшего сжатия
2. **Настройте роли** на этапе инициализации приложения
3. **Регулярно вызывайте `optimizeStorage()`** для поддержания хранилища в оптимальном состоянии
4. **Мониторьте отчеты** для выявления узких мест в использовании хранилища
5. **Используйте системные ключи** (с префиксом `system_`) для важных данных с ограниченным доступом
6. **Настройте минимальный размер сжатия** под ваши нужды для баланса производительности

## Ограничения

1. Реализации LZ и GZIP являются упрощенными и не заменяют полноценные алгоритмы сжатия
2. Для критически важных приложений рекомендуется использовать дополнительные механизмы безопасности
3. Аналитика хранилища требует дополнительных ресурсов, отключайте её при работе с большими объемами данных
4. Система контроля доступа не заменяет серверную аутентификацию

## Заключение

LASTkeep.js превращает STlocal.js в профессиональный инструмент для работы с localStorage, добавляя мощные функции аналитики, оптимизации и безопасности. Этот плагин особенно полезен для:

- Приложений с большими объемами данных в localStorage
- Систем с требованиями к безопасности данных
- Проектов, где важно отслеживать использование хранилища
- Приложений с разными уровнями доступа пользователей

Используя LASTkeep.js, вы получаете комплексное решение для управления данными в браузере с минимальными затратами на интеграцию и максимальной отдачей.