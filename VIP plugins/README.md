## Плагин VICook.js - Расширенное управление хранилищами для STlocal.js

**VICook.js** - премиальный VIP-плагин для работы с клиентскими хранилищами, предоставляющий комплексное решение для управления куки, локальным хранилищем, сессионным хранилищем и IndexedDB. Плагин предлагает унифицированный API, расширенную аналитику, автоматическую синхронизацию данных и продвинутые инструменты управления квотами.

---
### Установка:
```html
<script scr="https://cdn.jsdelivr.net/gh/Leha2cool/STlocal.js@main/VIP%20plugins/VICook.js"><script>
```
---

### Ключевые возможности

1. **Унифицированный API для всех типов хранилищ**
   - Работа с куки, localStorage, sessionStorage и IndexedDB через единый интерфейс
   - Автоматическое преобразование данных в JSON
   - Расширенные параметры конфигурации для каждого типа хранилища

2. **Автоматическая синхронизация данных**
   - Двунаправленная синхронизация между разными хранилищами
   - Настраиваемый интервал синхронизации
   - Выборочная синхронизация по ключам

3. **Мониторинг и аналитика**
   - Трекинг операций (чтение/запись/удаление)
   - Мониторинг использования квот хранилищ
   - Визуализация статистики использования

4. **Управление квотами**
   - Автоматическое предупреждение при достижении лимитов
   - Инструменты для оптимизации использования хранилищ
   - Поддержка стратегий очистки данных

5. **Безопасность и надежность**
   - Расширенные параметры безопасности для куки
   - Обработка ошибок и восстановление после сбоев
   - Гарантия целостности данных при синхронизации

---

### Инициализация и настройка

```javascript
const storage = new STlocal('app_');
const vicook = new VICook({
  cookie: {
    domain: 'example.com',
    path: '/',
    secure: true,
    sameSite: 'Strict'
  },
  storage: {
    default: 'auto', // 'cookie', 'localStorage', 'sessionStorage', 'indexedDB'
    sync: true,
    syncInterval: 10000
  },
  indexedDB: {
    name: 'AppDB',
    version: 2,
    objectStores: [
      { name: 'userData', keyPath: 'id' },
      { name: 'appSettings', keyPath: 'key' }
    ]
  },
  analytics: true,
  compression: false,
  quotaManagement: true
});

storage.use(vicook);
```

#### Параметры конфигурации:
- **cookie**: Настройки работы с куки
- **storage**: Основные настройки хранилищ
- **indexedDB**: Конфигурация IndexedDB
- **analytics**: Включение/отключение аналитики
- **compression**: Включение сжатия данных
- **quotaManagement**: Управление квотами хранилищ

---

### Работа с куки

#### Установка куки:
```javascript
storage.plugins.VICook.setCookie('preferences', { theme: 'dark', lang: 'en' }, {
  days: 30,
  secure: true,
  sameSite: 'Lax'
});
```

#### Получение куки:
```javascript
const prefs = storage.plugins.VICook.getCookie('preferences');
```

#### Удаление куки:
```javascript
storage.plugins.VICook.removeCookie('preferences');
```

#### Получение всех куки:
```javascript
const allCookies = storage.plugins.VICook.getAllCookies();
```

---

### Унифицированный API для хранилищ

#### Установка значения:
```javascript
// В localStorage
storage.plugins.VICook.setToStorage('localStorage', 'user_token', 'abc123xyz');

// В IndexedDB
storage.plugins.VICook.setToStorage('indexedDB', 'user_profile', {
  id: 123,
  name: 'John Doe',
  email: 'john@example.com'
});
```

#### Получение значения:
```javascript
const token = storage.plugins.VICook.getFromStorage('localStorage', 'user_token');
const profile = storage.plugins.VICook.getFromStorage('indexedDB', 'user_profile');
```

#### Удаление значения:
```javascript
storage.plugins.VICook.removeFromStorage('localStorage', 'user_token');
```

#### Получение всех ключей:
```javascript
const localStorageKeys = storage.plugins.VICook.getKeysFromStorage('localStorage');
const indexedDBKeys = storage.plugins.VICook.getKeysFromStorage('indexedDB');
```

#### Очистка хранилища:
```javascript
storage.plugins.VICook.clearStorage('sessionStorage');
```

---

### Синхронизация данных

#### Автоматическая синхронизация:
Включена по умолчанию с интервалом 10 секунд. Настраивается через параметры:
```javascript
sync: true,
syncInterval: 5000 // 5 секунд
```

#### Ручная синхронизация:
```javascript
// Синхронизация всех хранилищ
storage.plugins.VICook._syncStorages();

// Синхронизация конкретного ключа
storage.plugins.VICook._syncKey('user_settings', 'set', { theme: 'dark' });
```

---

### Аналитика и мониторинг

#### Получение данных аналитики:
```javascript
const analytics = storage.plugins.VICook.getAnalytics();

console.log('Операции записи:', analytics.operations.set);
console.log('Использование localStorage:', analytics.storageUsage.localStorage);
```

Пример возвращаемых данных:
```json
{
  "operations": {
    "get": 42,
    "set": 15,
    "remove": 3
  },
  "storageUsage": {
    "cookie": 1245,
    "localStorage": 24578,
    "sessionStorage": 512,
    "indexedDB": 102400
  },
  "timestamp": 1720099200000
}
```

#### Мониторинг квот:
```javascript
const quotaInfo = storage.plugins.VICook.getQuotaInfo();

console.log('Использование localStorage:', 
  `${quotaInfo.localStorage.usage}% (${quotaInfo.localStorage.size} байт из ${quotaInfo.localStorage.quota})`);
```

---

### Управление событиями

#### Подписка на события:
```javascript
// Предупреждение о заполнении квоты
storage.plugins.VICook.on('quota-warning', (data) => {
  console.warn(`Хранилище ${data.storageType} заполнено на ${data.usage}%!`);
  if (data.usage > 95) {
    // Автоматическая очистка старых данных
    storage.removeOldest(10);
  }
});

// Событие синхронизации
storage.plugins.VICook.on('sync-complete', (stats) => {
  console.log(`Синхронизировано ${stats.syncedKeys} ключей`);
});
```

#### Отписка от событий:
```javascript
const handler = (data) => { /* ... */ };
storage.plugins.VICook.on('quota-warning', handler);

// Позже
storage.plugins.VICook.off('quota-warning', handler);
```

---

### Работа с IndexedDB

#### Специфические методы:
```javascript
// Получение всех ключей из IndexedDB
storage.plugins.VICook._getKeysFromIndexedDB().then(keys => {
  console.log('Keys in IndexedDB:', keys);
});

// Очистка IndexedDB
storage.plugins.VICook._clearIndexedDB().then(() => {
  console.log('IndexedDB очищен');
});
```

---

### Оптимизация производительности

1. **Автоматическая пакетная обработка** операций записи
2. **Асинхронные операции** для IndexedDB
3. **Кэширование часто запрашиваемых данных**
4. **Оптимизированные алгоритмы** синхронизации
5. **Ленивая загрузка** для больших данных

---

### Безопасность

1. **Защищенные куки** с флагами Secure, HttpOnly и SameSite
2. **Шифрование конфиденциальных данных** (опционально)
3. **Валидация данных** при синхронизации
4. **Защита от XSS-атак** через автоматическое экранирование
5. **Контроль доступа** на уровне ключей

---

### Примеры использования

#### Комплексное хранение пользовательских данных:
```javascript
// Сохраняем данные в разные хранилища
storage.plugins.VICook.setCookie('session_id', 'SID123456789', { 
  secure: true, 
  sameSite: 'Strict',
  minutes: 30
});

storage.plugins.VICook.setToStorage('localStorage', 'user_prefs', {
  theme: 'dark',
  fontSize: 16,
  notifications: true
});

storage.plugins.VICook.setToStorage('indexedDB', 'user_history', [
  { page: '/home', time: Date.now() },
  { page: '/products', time: Date.now() - 3600000 }
]);

// Получаем данные из оптимального хранилища
const sessionId = storage.plugins.VICook.getCookie('session_id');
const prefs = storage.plugins.VICook.getFromStorage('localStorage', 'user_prefs');
const history = storage.plugins.VICook.getFromStorage('indexedDB', 'user_history');
```

#### Мониторинг и оптимизация хранилищ:
```javascript
// Подписка на события квот
storage.plugins.VICook.on('quota-warning', ({ storageType, usage }) => {
  if (storageType === 'localStorage' && usage > 90) {
    // Очистка устаревших данных
    const oldKeys = storage.findOldKeys(/temp_/);
    oldKeys.forEach(key => storage.remove(key));
    
    console.log(`Освобождено ${oldKeys.length} ключей в localStorage`);
  }
});

// Периодическая проверка квот
setInterval(() => {
  const quotaInfo = storage.plugins.VICook.getQuotaInfo();
  updateQuotaDashboard(quotaInfo);
}, 60000);
```

---

### FAQ и лучшие практики

**Q: Как выбрать оптимальное хранилище для разных типов данных?**
A: 
- **Куки**: Небольшие данные, требующие автоматической отправки на сервер
- **localStorage**: Данные приложения, сохраняемые между сессиями
- **sessionStorage**: Временные данные в рамках одной вкладки
- **IndexedDB**: Структурированные данные, большие объемы информации

**Q: Как плагин обрабатывает ограничения браузеров?**
A: Плагин автоматически:
- Определяет доступные хранилища
- Оптимизирует размер данных при достижении лимитов
- Переключается на альтернативные хранилища при ошибках
- Предоставляет подробные уведомления о проблемах

**Q: Как обеспечить безопасность чувствительных данных?**
A:
- Всегда используйте флаги `secure` и `httpOnly` для куки с персональными данными
- Для IndexedDB реализуйте дополнительное шифрование критических данных
- Ограничивайте срок жизни токенов и ключей доступа
- Никогда не храните пароли в клиентских хранилищах

---

### Системные требования и поддержка

**Требования:**
- STlocal.js версии 2.0+
- Современные браузеры (Chrome 58+, Firefox 54+, Safari 11+, Edge 16+)
- Поддержка ES6+

**Поддержка IndexedDB:**
- Chrome 23+
- Firefox 10+
- Safari 8+
- Edge 12+
- Opera 15+

**Размер плагина:**
- 12.8 KB (минифицированная версия)
- 4.2 KB (gzip-сжатая версия)

---

### Заключение

VICook.js предоставляет разработчикам комплексное решение для работы с клиентскими хранилищами, объединяя все современные API хранения данных под единым интерфейсом. С его мощными функциями синхронизации, продвинутыми инструментами мониторинга и интеллектуальным управлением квотами, плагин значительно упрощает разработку сложных веб-приложений, требующих надежного хранения данных на клиенте.

Благодаря детальной настройке, расширенной аналитике и системе уведомлений, VICook.js позволяет создавать отзывчивые и надежные веб-приложения, которые эффективно работают даже при ограниченных ресурсах клиентских устройств.

Для максимальной производительности рекомендуется:
- Использовать IndexedDB для структурированных данных
- Регулярно очищать устаревшие данные
- Мониторить использование квот через встроенную аналитику
- Настраивать стратегии синхронизации под конкретные нужды приложения
