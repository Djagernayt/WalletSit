const { contextBridge } = require('electron');

console.log('Preload script загружен');

contextBridge.exposeInMainWorld('api', {
  ping: async () => {
    console.log('window.api.ping вызван');
    try {
      const response = await fetch('https://ifehuadmwallet.link/wallet-api/api/ping');
      const text = await response.text();
      console.log('Ping ответ:', text);
      return text;
    } catch (error) {
      console.error('Ошибка при запросе ping:', error);
      throw error;
    }
  },
});