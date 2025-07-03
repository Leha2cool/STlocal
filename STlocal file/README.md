# STlocal.js - Расширенная библиотека для работы с localStorage

## Описание

STlocal.js - это мощная библиотека JavaScript, предоставляющая расширенные возможности для работы с localStorage. Она решает основные проблемы стандартной реализации, предлагая такие функции как пространства имен, время жизни данных (TTL), шифрование, систему событий и плагинов, а также множество дополнительных полезных функций.

### Ключевые особенности:
- **Пространства имен** - Изоляция данных разных модулей приложения
- **TTL (Time-To-Live)** - Автоматическое удаление устаревших данных
- **Шифрование** - Защита конфиденциальной информации
- **Система событий** - Реакция на изменения данных
- **Плагины** - Расширение функциональности
- **Статистика** - Анализ использования хранилища
- **Межвкладковое взаимодействие** - Синхронизация между вкладками
- **Групповые операции** - Массовые чтение/запись
- **Продвинутые операции** - Работа с массивами, инкремент, слияние объектов

## Установка



## Инициализация

### Базовое использование
```javascript
// Создание экземпляра
const storage = new STlocal();

// Установка значения
storage.set('theme', 'dark');

// Получение значения
const theme = storage.get('theme'); // 'dark'
```

### Создание пространства имен
```javascript
const userStorage = new STlocal('user_', {
  defaultTTL: 86400, // Время жизни по умолчанию (24 часа)
  encryptionKey: 'secret123' // Ключ шифрования
});

// Сохранение данных с шифрованием
userStorage.set('profile', {
  name: 'Alex',
  email: 'alex@example.com'
});
```

## Основные методы

### `set(key, value, options)`
Сохранение данных в хранилище

**Параметры:**
- `key` - Ключ для сохранения
- `value` - Значение (любой тип данных)
- `options` - Дополнительные параметры:
  - `ttl` - Время жизни в секундах
  - `encrypt` - Шифровать данные
  - `silent` - Не генерировать события

```javascript
// Сохранить данные на 1 час
storage.set('session', { token: 'abc123' }, { ttl: 3600 });
```

### `get(key, defaultValue, options)`
Получение данных из хранилища

**Параметры:**
- `key` - Ключ для получения
- `defaultValue` - Значение по умолчанию, если ключ отсутствует
- `options` - Дополнительные параметры:
  - `skipExpiration` - Пропустить проверку срока действия

```javascript
const session = storage.get('session', {});
```

### `remove(key, options)`
Удаление данных по ключу

```javascript
storage.remove('session');
```

### `clear(options)`
Очистка всех данных в пространстве имен

```javascript
storage.clear();
```

### `has(key)`
Проверка существования ключа

```javascript
if (storage.has('session')) {
  // Действия с сессией
}
```

## Расширенные методы

### Работа с TTL
```javascript
// Установка TTL для существующего ключа
storage.setTTL('session', 7200); // 2 часа

// Получение оставшегося времени жизни
const remaining = storage.getRemainingTTL('session'); // в миллисекундах
```

### Групповые операции
```javascript
// Массовая запись
storage.setMany({
  preferences: { theme: 'dark', fontSize: 16 },
  lastVisited: Date.now()
});

// Массовое чтение
const { preferences, lastVisited } = storage.getMany([
  'preferences', 
  'lastVisited'
]);
```

### Работа с массивами
```javascript
// Добавление в массив
storage.push('logs', 'User logged in');

// Удаление последнего элемента
const lastLog = storage.pop('logs');
```

### Статистика
```javascript
// Размер всех данных в хранилище
const totalSize = storage.getSize();

// Размер конкретного ключа
const keySize = storage.getSize('logs');
```

## Система событий

Библиотека предоставляет мощную систему событий для реагирования на изменения данных.

### Подписка на события
```javascript
// Изменение конкретного ключа
storage.on('change:theme', (newTheme) => {
  document.body.className = newTheme;
});

// Любое изменение в хранилище
storage.on('change', (key, newValue, oldValue) => {
  console.log(`Key ${key} changed from`, oldValue, 'to', newValue);
});

// Удаление ключа
storage.on('remove:session', () => {
  redirectToLogin();
});

// Ошибки
storage.on('error', (errorInfo) => {
  console.error('Storage error:', errorInfo);
});
```

### Отписка от событий
```javascript
const handler = (newValue) => { /* ... */ };

// Подписка
storage.on('change:cart', handler);

// Отписка
storage.off('change:cart', handler);
```

## Система плагинов

STlocal.js поддерживает создание плагинов для расширения функциональности.

### Пример плагина для валидации
```javascript
const schemaValidator = (schema) => ({
  hooks: {
    beforeSet: ({ key, value }) => {
      const { error } = schema.validate(value);
      if (error) throw new Error(`Validation failed for ${key}: ${error.message}`);
      return { key, value };
    }
  }
});

// Использование плагина
import Joi from 'joi';

const userSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required()
});

storage.use(schemaValidator(userSchema));
```

### Пример плагина для логирования
```javascript
const loggerPlugin = {
  hooks: {
    beforeSet: ({ key, value }) => {
      console.log(`Setting ${key}:`, value);
      return { key, value };
    },
    afterGet: ({ key, value }) => {
      console.log(`Getting ${key}:`, value);
      return { key, value };
    }
  }
};

storage.use(loggerPlugin);
```

## Шифрование данных

Для защиты конфиденциальной информации библиотека поддерживает шифрование.

### Использование шифрования
```javascript
// Создание хранилища с шифрованием
const secureStorage = new STlocal('vault_', {
  encryptionKey: 'my-strong-password'
});

// Сохранение с шифрованием
secureStorage.set('creditCard', '4111 1111 1111 1111');

// Автоматическая расшифровка при чтении
const card = secureStorage.get('creditCard');
```

### Смена ключа шифрования
```javascript
// Установка нового ключа
secureStorage.encryptWith('new-stronger-password');
```

## Межвкладковое взаимодействие

Библиотека автоматически синхронизирует изменения между вкладками браузера.

```javascript
// Событие сработает при изменении данных из другой вкладки
storage.on('change', (key, newValue) => {
  console.log(`Data changed from another tab: ${key} =`, newValue);
});
```

## Резервное копирование

### Экспорт данных
```javascript
// Экспорт всех данных в JSON
const backup = storage.export();
```

### Импорт данных
```javascript
// Восстановление из резервной копии
storage.import(backup);

// Импорт с объединением
storage.import(backup, { merge: true });
```

## Лучшие практики

1. **Пространства имен** - Всегда используйте пространства имен для изоляции данных разных модулей
2. **TTL для временных данных** - Устанавливайте время жизни для сессионных данных
3. **Шифрование конфиденциальных данных** - Всегда шифруйте персональные данные
4. **Обработка ошибок** - Подписывайтесь на события ошибок
5. **Статистика** - Регулярно проверяйте размер хранилища

```javascript
// Пример комплексного использования
const appStorage = new STlocal('app_', {
  defaultTTL: 3600,
  encryptionKey: 'app-secret-key'
});

appStorage
  .use(loggerPlugin)
  .use(schemaValidator(appSchema))
  .on('error', handleStorageError)
  .on('change:settings', updateUI);
  
appStorage.setMany({
  user: { id: 42, name: 'Alex' },
  settings: { theme: 'dark', notifications: true }
});
```

## Ограничения безопасности

Важно! Базовая реализация шифрования в библиотеке использует XOR-шифрование, что подходит только для базовой защиты. Для приложений с высокими требованиями безопасности:

1. Используйте Web Crypto API
2. Храните ключи шифрования безопасно
3. Регулярно обновляйте ключи шифрования
4. Не храните критически важные данные в localStorage

## Заключение

STlocal.js предоставляет мощный и удобный интерфейс для работы с localStorage, решая основные проблемы стандартной реализации. Библиотека подходит для широкого спектра задач - от простых веб-приложений до сложных SPA-проектов.


Для начала работы просто подключите библиотеку и начните использовать расширенные возможности управления данными в браузере!