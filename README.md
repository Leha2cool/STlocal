## STlocal.js - Продвинутая библиотека для работы с localStorage

**Версия:** 3.0.0  
**Дата:** 2025-07-04  
**GitHub:** https://github.com/Leha2cool  

### Введение
STlocal.js - это современная библиотека для работы с Web Storage (localStorage и sessionStorage), предоставляющая расширенные возможности:
- Пространства имен
- Автоматическое удаление просроченных данных (TTL)
- Шифрование данных
- Межвкладковую синхронизацию
- Систему событий и плагинов
- Поддержку сложных типов данных
- Статистику использования
- Резервное копирование

---

### Основные возможности

#### 1. **Инициализация**
```javascript
const storage = new STlocal(namespace, options);
```

**Параметры:**
- `namespace` (String): Префикс для всех ключей
- `options` (Object):
  - `namespaceSeparator` (String, по умолчанию ':'): Разделитель пространств имен
  - `defaultTTL` (Number): Время жизни записей в секундах
  - `encryptionKey` (String): Ключ для шифрования данных
  - `autoCleanup` (Boolean, true): Автоматическая очистка просроченных записей
  - `crossTabSync` (Boolean, true): Синхронизация между вкладками
  - `storageType` ('local'|'session'): Тип хранилища
  - `serializer/deserializer` (Function): Кастомные функции сериализации
  - `validator` (Function): Функция валидации данных
  - `cryptoEngine` ('simple'|'aes'): Алгоритм шифрования

---

### Основные методы

#### 2. **CRUD операции**
```javascript
// Запись данных
storage.set('key', value, { ttl: 3600, encrypt: true });

// Чтение данных
const value = storage.get('key', defaultValue);

// Удаление данных
storage.remove('key');

// Проверка наличия ключа
storage.has('key');

// Получение всех ключей
const keys = storage.keys();

// Очистка хранилища
storage.clear();
```

---

### Расширенные операции

#### 3. **Операции с коллекциями**
```javascript
// Пакетная запись
storage.setMany({ key1: value1, key2: value2 });

// Пакетное чтение
const values = storage.getMany(['key1', 'key2']);

// Пакетное удаление
storage.removeMany(['key1', 'key2']);
```

#### 4. **Операции с массивами**
```javascript
storage.push('cart', newItem);
storage.pop('cart');
storage.unshift('notifications', newNotification);
storage.shift('notifications');
```

#### 5. **Операции с числами и булевыми значениями**
```javascript
storage.increment('counter', 5);
storage.decrement('counter', 3);
storage.toggle('darkMode');
```

---

### Управление временем жизни (TTL)

#### 6. **Методы TTL**
```javascript
// Установка времени жизни
storage.setTTL('session', 1800);

// Получение оставшегося времени (мс)
const remaining = storage.getRemainingTTL('session');

// Получение даты истечения
const expires = storage.getExpirationDate('session');

// Ручная очистка просроченных данных
const removedCount = storage.cleanupExpired();
```

---

### Безопасность

#### 7. **Шифрование данных**
```javascript
// Установка ключа шифрования
storage.encryptWith('my-secret-key');

// Выбор алгоритма шифрования
storage.setCryptoEngine('aes'); // или 'simple'

// Шифрование отдельной записи
storage.set('token', sensitiveData, { encrypt: true });
```

---

### Пространства имен

#### 8. **Работа с пространствами имен**
```javascript
// Создание подпространства
const userStorage = storage.namespace('user');

// Работа в пространстве
userStorage.set('preferences', userPrefs);
userStorage.get('preferences');
```

---

### Система событий

#### 9. **Подписка на события**
```javascript
storage.on('change', (key, value) => {
  console.log(`Изменен ключ ${key}:`, value);
});

storage.on('change:cart', (value) => {
  console.log('Корзина изменена:', value);
});

storage.on('remove', (key, oldValue) => {
  console.log(`Удален ключ ${key}:`, oldValue);
});

storage.on('clear', () => {
  console.log('Хранилище очищено');
});

storage.on('error', (errorInfo) => {
  console.error('Ошибка:', errorInfo);
});
```

---

### Мониторинг изменений

#### 10. **Наблюдение за ключами**
```javascript
const unwatch = storage.watch('cart', (newValue, oldValue) => {
  console.log('Корзина изменилась:', { newValue, oldValue });
}, 1000);

// Отмена наблюдения
unwatch();
```

---

### Статистика и аналитика

#### 11. **Метрики хранилища**
```javascript
const stats = storage.getStats();
/*
{
  keys: 15,
  size: 24576, // в байтах
  available: 5242880, // доступное место
  quota: 10485760, // общий лимит
  namespace: 'app',
  storageType: 'local'
}
*/
```

#### 12. **Размер данных**
```javascript
// Размер конкретного ключа
const keySize = storage.getSize('userData');

// Общий размер хранилища
const totalSize = storage.getSize();
```

---

### Резервное копирование

#### 13. **Экспорт и импорт**
```javascript
// Создание резервной копии
const backup = storage.export({
  includeExpired: true // включать просроченные данные
});

// Восстановление из резервной копии
storage.import(backup, {
  merge: true, // объединить с текущими данными
  overwrite: false // не перезаписывать существующие ключи
});
```

---

### Расширение функционала

#### 14. **Плагины**
```javascript
const loggerPlugin = {
  hooks: {
    beforeSet: (data) => {
      console.log(`Запись ${data.key}:`, data.value);
      return data;
    },
    afterGet: (data) => {
      console.log(`Чтение ${data.key}:`, data.value);
      return data;
    }
  }
};

storage.use(loggerPlugin);
```

#### 15. **Транзакции**
```javascript
storage.transaction({
  set: { theme: 'dark', fontSize: 16 },
  remove: ['tempData']
});
```

---

### Особенности работы

#### 16. **Обработка специальных типов**
Библиотека автоматически обрабатывает:
- Date
- Set
- Map
- RegExp
- Blob (через плагины)

#### 17. **Система ошибок**
Все ошибки генерируют события:
```javascript
storage.on('error', (errorInfo) => {
  console.error(`Ошибка в ${errorInfo.operation}`, errorInfo.error);
});
```

#### 18. **Автоочистка**
При включенной опции `autoCleanup` просроченные записи автоматически удаляются каждые 60 секунд.

---

### Примеры использования

#### Базовый пример
```javascript
const storage = new STlocal('myApp', {
  defaultTTL: 3600, // 1 час
  encryptionKey: 'secret123'
});

storage.set('user', { id: 1, name: 'John' }, { ttl: 86400 });
const user = storage.get('user');
```

#### Пример с шифрованием
```javascript
const secureStorage = new STlocal('vault', {
  encryptionKey: 'supersecret',
  cryptoEngine: 'aes'
});

secureStorage.set('apiKey', 'ABC-123-XYZ', { encrypt: true });
const apiKey = secureStorage.get('apiKey');
```

#### Пример с плагинами
```javascript
const expirationChecker = {
  hooks: {
    beforeGet: (data) => {
      if (data.meta.expires && data.meta.expires < Date.now()) {
        console.warn(`Ключ ${data.key} просрочен!`);
      }
      return data;
    }
  }
};

storage.use(expirationChecker);
```

---

### Ограничения
1. Размер хранилища ограничен 5-10 МБ
2. Шифрование AES требует HTTPS
3. Сложные объекты сериализуются в JSON
4. Для работы в IE11 необходимы полифиллы

### Заключение
STlocal.js предоставляет мощный инструментарий для работы с клиентским хранилищем, включая:
- Управление пространствами имен
- Автоматическую очистку
- Шифрование данных
- Межвкладковую синхронизацию
- Расширяемую систему плагинов
- Детальную статистику
- Резервное копирование

Библиотека идеально подходит для создания сложных клиентских приложений, требующих надежного и безопасного хранения данных.