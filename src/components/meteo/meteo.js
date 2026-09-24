document.addEventListener('DOMContentLoaded', () => {
    const customIcons = {
      '01d': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/clear-day.svg',
      '01n': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/clear-night.svg',
      '02d': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/partly-cloudy-day.svg',
      '02n': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/partly-cloudy-night.svg',
      '03d': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/cloudy.svg',
      '03n': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/cloudy.svg',
      '04d': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/overcast-day.svg',
      '04n': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/overcast-night.svg',
      '09d': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/partly-cloudy-day-rain.svg',
      '09n': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/partly-cloudy-night-rain.svg',
      '10d': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/rain.svg',
      '10n': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/rain.svg',
      '11d': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/thunderstorms.svg',
      '11n': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/thunderstorms.svg',
      '13d': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/snow.svg',
      '13n': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/snow.svg',
      '50d': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/mist.svg',
      '50n': 'https://cdn.jsdelivr.net/gh/basmilius/weather-icons/production/fill/all/mist.svg'
    };

    function esc(s) {
      if (window.AppSanitize) return window.AppSanitize.escapeHtml(s);
      return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    }

    function renderWeatherData(data, isCached = false) {
      const hourlyContainer = document.getElementById('hourly');
      const dailyContainer = document.getElementById('daily');

      if (data && data.city && data.city.name) {
        const cityHeader = document.querySelector('.current-weather h2');
        if (cityHeader) cityHeader.textContent = data.city.name + (isCached ? ' (cache)' : '');
      }

      if (data && data.list && data.list.length > 0) {
        const current = data.list[0];
        const currentTemp = Math.round(current.main.temp);
        const currentDesc = current.weather[0].description;
        const currentIcon = current.weather[0].icon;
        const currentIconUrl = customIcons[currentIcon] || `https://openweathermap.org/img/wn/${currentIcon}.png`;

        const next24h = data.list.slice(0, 8);
        const temps24h = next24h.map(item => item.main.temp);
        const minTemp = Math.round(Math.min(...temps24h));
        const maxTemp = Math.round(Math.max(...temps24h));

        const tempDiv = document.querySelector('.current-weather .temp');
        if (tempDiv) {
          tempDiv.textContent = "";
          const iconImg = document.createElement('img');
          iconImg.src = currentIconUrl;
          iconImg.className = "current-icon";
          iconImg.alt = "";
          tempDiv.appendChild(iconImg);
          tempDiv.append(document.createTextNode(currentTemp + "°"));
        }

        const detailsDiv = document.querySelector('.current-weather .details');
        if (detailsDiv) {
          const textDesc = currentDesc.charAt(0).toUpperCase() + currentDesc.slice(1);
          detailsDiv.textContent = "";
          const p1 = document.createElement('p');
          p1.textContent = textDesc;
          const p2 = document.createElement('p');
          p2.textContent = `↓ ${minTemp}° ↑ ${maxTemp}°`;
          detailsDiv.appendChild(p1);
          detailsDiv.appendChild(p2);
        }
      }

      if (hourlyContainer) {
        hourlyContainer.textContent = "";
        const nextHours = data.list.slice(0, 5);
        nextHours.forEach(item => {
          const hour = new Date(item.dt * 1000).getHours();
          const temp = Math.round(item.main.temp);
          const icon = item.weather[0].icon;
          const iconUrl = customIcons[icon] || `https://openweathermap.org/img/wn/${icon}.png`;
          const hourDiv = document.createElement('div');
          hourDiv.className = 'hour';
          const hp = document.createElement('p');
          hp.textContent = hour + ":00";
          const img = document.createElement('img');
          img.src = iconUrl;
          img.alt = "";
          img.loading = "lazy";
          const tp = document.createElement('p');
          tp.textContent = temp + "°";
          hourDiv.appendChild(hp);
          hourDiv.appendChild(img);
          hourDiv.appendChild(tp);
          hourlyContainer.appendChild(hourDiv);
        });
      }

      if (dailyContainer) {
        dailyContainer.textContent = "";
        const days = {};
        data.list.forEach(item => {
          const date = new Date(item.dt * 1000);
          let dayName = date.toLocaleDateString('it-IT', { weekday: 'short' });
          dayName = dayName.replace('.', '');
          dayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
          
          if (!days[dayName]) days[dayName] = { temps: [], icon: item.weather[0].icon };
          days[dayName].temps.push(item.main.temp);
        });

        Object.entries(days).slice(0, 5).forEach(([day, info]) => {
          const min = Math.round(Math.min(...info.temps));
          const max = Math.round(Math.max(...info.temps));
          const iconUrl = customIcons[info.icon] || `https://openweathermap.org/img/wn/${info.icon}.png`;
          const row = document.createElement('div');
          row.className = 'day-row';
          const daySpan = document.createElement('span');
          daySpan.textContent = day;
          const img = document.createElement('img');
          img.src = iconUrl;
          img.alt = "";
          img.loading = "lazy";
          const temps = document.createElement('div');
          temps.className = 'temps';
          const minSpan = document.createElement('span');
          minSpan.textContent = min + "°";
          const bar = document.createElement('div');
          bar.className = 'bar';
          const fill = document.createElement('div');
          fill.className = 'bar-fill';
          fill.style.width = Math.max(2, Math.min(80, (max - min) * 4)) + "px";
          bar.appendChild(fill);
          const maxSpan = document.createElement('span');
          maxSpan.textContent = max + "°";
          temps.appendChild(minSpan);
          temps.appendChild(bar);
          temps.appendChild(maxSpan);
          row.appendChild(daySpan);
          row.appendChild(img);
          row.appendChild(temps);
          dailyContainer.appendChild(row);
        });
      }
    }

    async function getWeather() {
      if (localStorage.getItem('weather_enabled') !== 'true') {
        return;
      }
      const apiKey = localStorage.getItem('weather_api_key');
      const lat = localStorage.getItem('weather_lat') || 38.100470;
      const lon = localStorage.getItem('weather_lon') || 13.353646;

      const hourlyContainer = document.getElementById('hourly');
      const dailyContainer = document.getElementById('daily');

      if (!apiKey) {
        const cityHeader = document.querySelector('.current-weather h2');
        if (cityHeader) cityHeader.textContent = "Meteo";
        const tempDiv = document.querySelector('.current-weather .temp');
        if (tempDiv) tempDiv.textContent = "--";
        const detailsDiv = document.querySelector('.current-weather .details');
        if (detailsDiv) detailsDiv.textContent = "";
        if (hourlyContainer) hourlyContainer.innerHTML = "";
        if (dailyContainer) {
          dailyContainer.textContent = "";
          const warn = document.createElement('div');
          warn.style.cssText = "grid-column:1/-1;padding:15px;color:#ff6b6b;font-size:13px;text-align:center;";
          warn.textContent = "⚠️ Configura la chiave OpenWeatherMap nelle impostazioni (⚙️) per vedere il meteo.";
          dailyContainer.appendChild(warn);
        }
        return;
      }

      try {
        const cached = localStorage.getItem('weather_full_cache');
        if (cached) {
          const c = JSON.parse(cached);
          if (c && c.data && (Date.now() - c.ts < 30 * 60 * 1000) && String(c.lat) === String(lat) && String(c.lon) === String(lon)) {
            renderWeatherData(c.data, true);
            return;
          }
        }
      } catch (e) {}

      let data;
      try {
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&appid=${encodeURIComponent(apiKey)}&units=metric&lang=it`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(forecastUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        data = await response.json();
      } catch (err) {
        console.error("Errore meteo:", err);
        try {
          const cached = localStorage.getItem('weather_full_cache');
          if (cached) {
            const c = JSON.parse(cached);
            if (c && c.data && (Date.now() - c.ts < 24 * 60 * 60 * 1000)) {
              renderWeatherData(c.data, true);
              return;
            }
          }
        } catch (e) {}

        if (dailyContainer) {
          dailyContainer.textContent = "";
          const warn = document.createElement('div');
          warn.style.cssText = "grid-column:1/-1;padding:15px;color:#ff6b6b;font-size:13px;text-align:center;";
          warn.textContent = "⚠️ Meteo non disponibile (" + (err.name === 'AbortError' ? 'timeout' : err.message) + "). Riprova più tardi.";
          dailyContainer.appendChild(warn);
        }
        return;
      }

      try {
        localStorage.setItem('weather_full_cache', JSON.stringify({ ts: Date.now(), lat, lon, data }));
      } catch (e) {}

      renderWeatherData(data, false);
    }

    getWeather();
});