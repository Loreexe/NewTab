document.addEventListener('DOMContentLoaded', () => {
    // Funzione per aggiornare l'orologio
    function updateClock() {
        const now = new Date();
      
        // Ottieni ore e minuti
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
      
        // Giorno della settimana
        const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
        const dayOfWeek = days[now.getDay()];
      
        // Giorno e mese
        const day = now.getDate();
        const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        const month = months[now.getMonth()];
      
        // Formatta la data
        const formattedDate = `${hours}:${minutes}  ${dayOfWeek}-${day}-${month}`;
      
        // Aggiorna il contenuto dell'orologio
        const clockEl = document.getElementById('clock');
        if (clockEl) {
            clockEl.textContent = formattedDate;
        }
      }
      
      // Aggiorna l'orologio ogni secondo
      setInterval(updateClock, 1000);
      updateClock(); // Aggiorna subito alla prima apertura
});