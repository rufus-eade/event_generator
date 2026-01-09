// Calendar URLs with assigned colors
const CALENDAR_URLS = [
    {
        name: 'South East Green Party',
        url: 'https://calendar.google.com/calendar/ical/e12df6463e49fcbc21d4a8edfe5ebcd7807340dfb861a77955a1cd60a9b5a028%40group.calendar.google.com/public/basic.ics',
        color: '#e74c3c' // Red
    },
    {
        name: 'East Hampshire Green Party',
        url: 'https://calendar.google.com/calendar/ical/c_efb1b357b9c469042ecc442dc0f4af8bd3e51d0f3b992962476208dc9ff25220%40group.calendar.google.com/public/basic.ics',
        color: '#3498db' // Blue
    },
    {
        name: 'EHGP Events & Comms',
        url: 'https://calendar.google.com/calendar/ical/c_f59a208a3b12a9a1700ed74bc610357fcdf20f1cd28d1eb0719f031a00d18229%40group.calendar.google.com/public/basic.ics',
        color: '#9b59b6' // Purple
    }
];

const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
];

// Colors for canvas
const CARD_COLOR = '#00643b';

// Card dimensions
const CARD_HEIGHT_NO_LOCATION = 110;
const CARD_HEIGHT_WITH_LOCATION = 140;
const CARD_GAP = 20;

// Global state
let allEvents = [];
let selectedEvents = new Set();
let currentMonth = new Date();
let eventsByMonth = {};
let logoImage = null;
let fontsLoaded = false;

// Get calendar color by name
function getCalendarColor(calendarName) {
    const calendar = CALENDAR_URLS.find(c => c.name === calendarName);
    return calendar ? calendar.color : '#888888';
}

// Get calendar index by name
function getCalendarIndex(calendarName) {
    return CALENDAR_URLS.findIndex(c => c.name === calendarName);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initCalendarStatus();
    initStyleListeners();
    loadFonts();
    loadLogo();
    loadCalendars();
});

// Generate calendar status elements dynamically
function initCalendarStatus() {
    const container = document.getElementById('calendarStatus');
    container.innerHTML = CALENDAR_URLS.map((cal, index) => `
        <div class="status-item" id="calendarStatus${index}">
            <span class="status-dot loading" style="background: ${cal.color};"></span>
            <span class="status-text">${cal.name}: Waiting...</span>
        </div>
    `).join('');
}

// Load fonts for canvas
function loadFonts() {
    const bebasNeue = new FontFace('Bebas Neue', 'url(https://fonts.gstatic.com/s/bebasneue/v14/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2)');
    const manrope = new FontFace('Manrope', 'url(https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2)');
    const manropeBold = new FontFace('Manrope', 'url(https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2)', { weight: '700' });

    Promise.all([
        bebasNeue.load(),
        manrope.load(),
        manropeBold.load()
    ]).then(fonts => {
        fonts.forEach(font => document.fonts.add(font));
        fontsLoaded = true;
        console.log('Fonts loaded');
        updateCanvas();
    }).catch(err => {
        console.error('Font loading failed:', err);
        fontsLoaded = true;
        updateCanvas();
    });
}

// Load logo image
function loadLogo() {
    logoImage = new Image();
    logoImage.crossOrigin = 'anonymous';
    logoImage.onload = () => {
        console.log('Logo loaded successfully');
        updateCanvas();
    };
    logoImage.onerror = () => {
        console.error('Failed to load logo');
        logoImage = null;
    };
    logoImage.src = 'assets/green-party_east-hampshire_long-left.jpg';
}

// Style change listeners
function initStyleListeners() {
    const styleInputs = ['canvasTitle'];
    styleInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', updateCanvas);
            element.addEventListener('input', updateCanvas);
        }
    });
}

// Update status for a calendar
function updateCalendarStatus(index, status, message) {
    const statusEl = document.getElementById(`calendarStatus${index}`);
    if (!statusEl) return;
    
    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('.status-text');
    
    dot.classList.remove('loading', 'error');
    
    if (status === 'loading') {
        dot.classList.add('loading');
    } else if (status === 'error') {
        dot.classList.add('error');
    }
    
    text.textContent = message;
}

// Load all calendars
function loadCalendars() {
    allEvents = [];
    selectedEvents.clear();
    
    let loadedCount = 0;

    CALENDAR_URLS.forEach((calendar, index) => {
        updateCalendarStatus(index, 'loading', `${calendar.name}: Loading...`);

        fetchCalendarWithProxies(calendar.url, 0)
            .then(content => {
                const events = parseICSContent(content, calendar.name);
                allEvents = allEvents.concat(events);
                
                updateCalendarStatus(index, 'success', `${calendar.name}: ${events.length} events`);
                
                loadedCount++;
                if (loadedCount === CALENDAR_URLS.length) {
                    finalizeLoading();
                }
            })
            .catch(error => {
                console.error(`Failed to load ${calendar.name}:`, error);
                updateCalendarStatus(index, 'error', `${calendar.name}: Failed`);
                
                loadedCount++;
                if (loadedCount === CALENDAR_URLS.length) {
                    finalizeLoading();
                }
            });
    });
}

function reloadCalendars() {
    initCalendarStatus();
    loadCalendars();
}

function fetchCalendarWithProxies(url, proxyIndex) {
    return new Promise((resolve, reject) => {
        if (proxyIndex >= CORS_PROXIES.length) {
            reject(new Error('All proxies failed'));
            return;
        }

        const proxyUrl = CORS_PROXIES[proxyIndex] + encodeURIComponent(url);
        
        fetch(proxyUrl)
            .then(response => {
                if (!response.ok) throw new Error('HTTP error');
                return response.text();
            })
            .then(content => {
                if (!content.includes('BEGIN:VCALENDAR') && !content.includes('BEGIN:VEVENT')) {
                    throw new Error('Invalid ICS');
                }
                resolve(content);
            })
            .catch(error => {
                console.log(`Proxy ${proxyIndex + 1} failed, trying next...`);
                fetchCalendarWithProxies(url, proxyIndex + 1)
                    .then(resolve)
                    .catch(reject);
            });
    });
}

function finalizeLoading() {
    // Sort all events by date
    allEvents.sort((a, b) => {
        if (!a.start) return 1;
        if (!b.start) return -1;
        return a.start - b.start;
    });

    // Remove duplicates based on title + start time
    const seen = new Set();
    allEvents = allEvents.filter(event => {
        const key = `${event.title}-${event.start?.getTime()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Group by month
    groupEventsByMonth();

    // Set current month to first future event or current month
    const now = new Date();
    const futureEvent = allEvents.find(e => e.start && e.start >= now);
    if (futureEvent) {
        currentMonth = new Date(futureEvent.start.getFullYear(), futureEvent.start.getMonth(), 1);
    } else if (allEvents.length > 0 && allEvents[0].start) {
        currentMonth = new Date(allEvents[0].start.getFullYear(), allEvents[0].start.getMonth(), 1);
    }

    renderMonthNav();
    renderEventsList();
    updateSelectedCount();
    updateCanvas();
}

// ICS Parsing
function parseICSContent(content, calendarName) {
    const events = [];
    
    const rawLines = content.split(/\r?\n/);
    const lines = [];
    
    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        if (line.startsWith(' ') || line.startsWith('\t')) {
            if (lines.length > 0) {
                lines[lines.length - 1] += line.substring(1);
            }
        } else {
            lines.push(line);
        }
    }

    let currentEvent = null;
    let inEvent = false;

    for (const line of lines) {
        if (line === 'BEGIN:VEVENT') {
            inEvent = true;
            currentEvent = {
                title: '',
                start: null,
                end: null,
                location: '',
                description: '',
                allDay: false,
                calendar: calendarName
            };
            continue;
        }
        
        if (line === 'END:VEVENT') {
            if (currentEvent && (currentEvent.title || currentEvent.start)) {
                if (!currentEvent.title) {
                    currentEvent.title = '(No title)';
                }
                events.push(currentEvent);
            }
            currentEvent = null;
            inEvent = false;
            continue;
        }

        if (!inEvent || !currentEvent) continue;

        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const fullKey = line.substring(0, colonIndex);
        const value = line.substring(colonIndex + 1);
        const semiIndex = fullKey.indexOf(';');
        const baseKey = semiIndex !== -1 ? fullKey.substring(0, semiIndex) : fullKey;

        switch (baseKey) {
            case 'SUMMARY':
                currentEvent.title = unescapeICS(value);
                break;
            case 'DTSTART':
                currentEvent.start = parseICSDate(value, fullKey);
                currentEvent.allDay = fullKey.includes('VALUE=DATE') || value.length === 8;
                break;
            case 'DTEND':
                currentEvent.end = parseICSDate(value, fullKey);
                break;
            case 'LOCATION':
                currentEvent.location = unescapeICS(value);
                break;
            case 'DESCRIPTION':
                currentEvent.description = unescapeICS(value);
                break;
        }
    }

    return events;
}

function groupEventsByMonth() {
    eventsByMonth = {};
    
    allEvents.forEach((event, index) => {
        if (event.start) {
            const key = `${event.start.getFullYear()}-${String(event.start.getMonth() + 1).padStart(2, '0')}`;
            if (!eventsByMonth[key]) {
                eventsByMonth[key] = [];
            }
            eventsByMonth[key].push(index);
        }
    });
}

function unescapeICS(str) {
    if (!str) return '';
    return str
        .replace(/\\n/gi, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
}

function parseICSDate(dateStr, fullKey) {
    if (!dateStr) return null;
    
    const isDateOnly = (fullKey && fullKey.includes('VALUE=DATE')) || dateStr.length === 8;
    dateStr = dateStr.replace(/^TZID=[^:]+:/, '');
    
    try {
        if (isDateOnly || dateStr.length === 8) {
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1;
            const day = parseInt(dateStr.substring(6, 8));
            return new Date(year, month, day);
        } else if (dateStr.includes('T')) {
            const isUTC = dateStr.endsWith('Z');
            dateStr = dateStr.replace('Z', '');
            
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1;
            const day = parseInt(dateStr.substring(6, 8));
            const hour = parseInt(dateStr.substring(9, 11)) || 0;
            const minute = parseInt(dateStr.substring(11, 13)) || 0;
            const second = parseInt(dateStr.substring(13, 15)) || 0;
            
            if (isUTC) {
                return new Date(Date.UTC(year, month, day, hour, minute, second));
            }
            return new Date(year, month, day, hour, minute, second);
        }
    } catch (e) {
        console.error('Error parsing date:', dateStr, e);
    }
    return null;
}

// Month navigation
function getMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(date) {
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function previousMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    renderMonthNav();
    renderEventsList();
}

function nextMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    renderMonthNav();
    renderEventsList();
}

function goToMonth(year, month) {
    currentMonth = new Date(year, month, 1);
    renderMonthNav();
    renderEventsList();
}

function renderMonthNav() {
    const label = document.getElementById('currentMonthLabel');
    const quickNav = document.getElementById('monthQuickNav');
    
    const currentKey = getMonthKey(currentMonth);
    const eventsInMonth = eventsByMonth[currentKey] || [];
    
    label.textContent = `${getMonthLabel(currentMonth)} (${eventsInMonth.length})`;
    
    const sortedMonths = Object.keys(eventsByMonth).sort();
    quickNav.innerHTML = sortedMonths.map(key => {
        const [year, month] = key.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        const shortLabel = date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        const count = eventsByMonth[key].length;
        const isActive = key === currentKey;
        
        return `<span class="month-chip ${isActive ? 'active' : ''}" 
                      onclick="goToMonth(${year}, ${parseInt(month) - 1})">
                    ${shortLabel}<span class="count">${count}</span>
                </span>`;
    }).join('');
}

// Event list rendering
function renderEventsList() {
    const container = document.getElementById('eventsList');
    const currentKey = getMonthKey(currentMonth);
    const eventIndices = eventsByMonth[currentKey] || [];
    
    if (allEvents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Loading events...</p>
            </div>
        `;
        return;
    }
    
    if (eventIndices.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No events in ${getMonthLabel(currentMonth)}</p>
            </div>
        `;
        return;
    }

    // Group events by day
    const eventsByDay = {};
    eventIndices.forEach(index => {
        const event = allEvents[index];
        if (event.start) {
            const dayKey = event.start.toDateString();
            if (!eventsByDay[dayKey]) {
                eventsByDay[dayKey] = [];
            }
            eventsByDay[dayKey].push({ event, index });
        }
    });

    let html = '';
    const sortedDays = Object.keys(eventsByDay).sort((a, b) => new Date(a) - new Date(b));
    
    sortedDays.forEach(dayKey => {
        const date = new Date(dayKey);
        const dayLabel = date.toLocaleDateString('en-GB', { 
            weekday: 'long', 
            day: 'numeric',
            month: 'short'
        });
        
        html += `<div class="day-header">${dayLabel}</div>`;
        
        eventsByDay[dayKey].forEach(({ event, index }) => {
            const timeStr = event.allDay ? 'All day' : formatTime(event.start);
            const calendarColor = getCalendarColor(event.calendar);
            
            html += `
                <div class="event-item ${selectedEvents.has(index) ? 'selected' : ''}" 
                     onclick="toggleEvent(${index})">
                    <span class="event-calendar-dot" style="background: ${calendarColor};" title="${event.calendar}"></span>
                    <div class="event-content">
                        <div class="event-title">${escapeHtml(event.title)}</div>
                        <div class="event-time">${timeStr}</div>
                        ${event.location ? `<div class="event-location">${escapeHtml(event.location)}</div>` : ''}
                    </div>
                </div>
            `;
        });
    });

    container.innerHTML = html;
}

function formatTime(date) {
    if (!date) return '';
    return date.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
}

function formatTimeForCanvas(date) {
    if (!date) return '';
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    if (minutes === 0) {
        return `${hour12}${ampm}`;
    }
    return `${hour12}:${String(minutes).padStart(2, '0')}${ampm}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event selection
function toggleEvent(index) {
    if (selectedEvents.has(index)) {
        selectedEvents.delete(index);
    } else {
        selectedEvents.add(index);
    }
    renderEventsList();
    updateSelectedCount();
    updateCanvas();
}

function selectAllInMonth() {
    const currentKey = getMonthKey(currentMonth);
    const eventIndices = eventsByMonth[currentKey] || [];
    eventIndices.forEach(index => selectedEvents.add(index));
    renderEventsList();
    updateSelectedCount();
    updateCanvas();
}

function deselectAll() {
    selectedEvents.clear();
    renderEventsList();
    updateSelectedCount();
    updateCanvas();
}

function updateSelectedCount() {
    const count = selectedEvents.size;
    document.getElementById('selectedCount').textContent = 
        count === 0 ? 'No events selected' : 
        count === 1 ? '1 event selected' : 
        `${count} events selected`;
}

// Calculate total height needed for events
function calculateTotalEventsHeight(events) {
    let totalHeight = 0;
    events.forEach(event => {
        const cardHeight = event.location ? CARD_HEIGHT_WITH_LOCATION : CARD_HEIGHT_NO_LOCATION;
        totalHeight += cardHeight + CARD_GAP;
    });
    // Remove last gap
    if (events.length > 0) {
        totalHeight -= CARD_GAP;
    }
    return totalHeight;
}

// Calculate how many events can fit
function calculateEventsToShow(events, availableHeight) {
    let totalHeight = 0;
    let count = 0;
    
    for (const event of events) {
        const cardHeight = event.location ? CARD_HEIGHT_WITH_LOCATION : CARD_HEIGHT_NO_LOCATION;
        const neededHeight = totalHeight + cardHeight + (count > 0 ? CARD_GAP : 0);
        
        if (neededHeight > availableHeight) {
            break;
        }
        
        totalHeight = neededHeight;
        count++;
    }
    
    return count;
}

// Canvas rendering - Instagram size 1080x1350
function updateCanvas() {
    const canvas = document.getElementById('eventCanvas');
    const ctx = canvas.getContext('2d');
    
    const canvasTitle = document.getElementById('canvasTitle').value;

    // Instagram dimensions
    canvas.width = 1080;
    canvas.height = 1350;

    const selected = Array.from(selectedEvents)
        .map(i => allEvents[i])
        .filter(e => e)
        .sort((a, b) => {
            if (!a.start) return 1;
            if (!b.start) return -1;
            return a.start - b.start;
        });

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const padding = 100;
    let headerHeight = padding + 20;

    // Title (Bebas Neue)
    if (canvasTitle) {
        ctx.fillStyle = CARD_COLOR;
        ctx.font = '72px "Bebas Neue", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(canvasTitle.toUpperCase(), canvas.width / 2, headerHeight + 70);
        headerHeight += 100;
    }

    // Calculate available space for events (leave room for logo)
    const logoHeight = 120;
    const logoMargin = 60;
    const availableHeight = canvas.height - headerHeight - logoHeight - logoMargin - padding;

    if (selected.length === 0) {
        ctx.fillStyle = '#999999';
        ctx.font = '500 28px "Manrope", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Select events to display', canvas.width / 2, headerHeight + availableHeight / 2);
    } else {
        // Calculate how many events we can show
        const maxEvents = calculateEventsToShow(selected, availableHeight);
        const eventsToShow = selected.slice(0, maxEvents);
        
        // Calculate total height of events to show
        const totalEventsHeight = calculateTotalEventsHeight(eventsToShow);
        
        // Calculate starting Y to vertically center the events
        const startY = headerHeight + (availableHeight - totalEventsHeight) / 2;
        
        drawEventCards(ctx, eventsToShow, startY, padding, selected.length - maxEvents);
    }

    // Draw logo at bottom
    drawLogo(ctx, padding, logoHeight);
}

function drawEventCards(ctx, events, startY, padding, remainingCount) {
    let y = startY;
    
    events.forEach((event) => {
        const hasLocation = !!event.location;
        const cardHeight = hasLocation ? CARD_HEIGHT_WITH_LOCATION : CARD_HEIGHT_NO_LOCATION;
        const cardWidth = 1080 - (padding * 2);
        const x = padding;
        
        // Card background (green)
        ctx.fillStyle = CARD_COLOR;
        roundRect(ctx, x, y, cardWidth, cardHeight, 16, true, false);
        
        // Date badge (white rounded rectangle on left)
        const badgeWidth = 140;
        const badgeHeight = 90;
        const badgeX = x + 20;
        const badgeY = y + (cardHeight - badgeHeight) / 2;
        
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 12, true, false);
        
        // Date text inside badge
        const day = event.start.getDate();
        const month = event.start.toLocaleDateString('en-GB', { month: 'short' });
        
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'center';
        
        // Day number (Bebas Neue)
        ctx.font = '52px "Bebas Neue", sans-serif';
        ctx.fillText(day.toString(), badgeX + badgeWidth / 2, badgeY + 50);
        
        // Month (Manrope)
        ctx.font = '600 22px "Manrope", sans-serif';
        ctx.fillText(month, badgeX + badgeWidth / 2, badgeY + 78);
        
        // Event title (Manrope, white) - keep original case
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 32px "Manrope", sans-serif';
        ctx.textAlign = 'left';
        const titleX = badgeX + badgeWidth + 30;
        const titleMaxWidth = cardWidth - badgeWidth - 100;
        
        // Calculate vertical positions based on whether there's a location
        let titleY, timeY, locationY;
        
        if (hasLocation) {
            // With location: title, time, location on separate lines
            titleY = y + 45;
            timeY = y + 80;
            locationY = y + 115;
        } else {
            // Without location: title and time vertically centered
            titleY = y + (cardHeight / 2) - 5;
            timeY = y + (cardHeight / 2) + 30;
        }
        
        ctx.fillText(truncateText(ctx, event.title, titleMaxWidth), titleX, titleY);
        
        // Time (Manrope, white, smaller)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '500 24px "Manrope", sans-serif';
        
        let timeText = '';
        if (!event.allDay && event.start) {
            timeText = formatTimeForCanvas(event.start);
        } else {
            timeText = 'All day';
        }
        
        ctx.fillText(timeText, titleX, timeY);
        
        // Location on separate line (if exists)
        if (hasLocation) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = '500 22px "Manrope", sans-serif';
            ctx.fillText(truncateText(ctx, event.location, titleMaxWidth), titleX, locationY);
        }
        
        ctx.textAlign = 'left';
        y += cardHeight + CARD_GAP;
    });
    
    // If there are more events, show count
    if (remainingCount > 0) {
        ctx.fillStyle = CARD_COLOR;
        ctx.font = '500 24px "Manrope", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`+ ${remainingCount} more events`, 540, y + 20);
    }
}

function drawLogo(ctx, padding, logoHeight) {
    const logoY = 1350 - logoHeight - 80;
    
    if (logoImage && logoImage.complete && logoImage.naturalWidth > 0) {
        const maxWidth = 500;
        const aspectRatio = logoImage.naturalWidth / logoImage.naturalHeight;
        let logoWidth = maxWidth;
        let logoDrawHeight = logoWidth / aspectRatio;
        
        if (logoDrawHeight > logoHeight) {
            logoDrawHeight = logoHeight;
            logoWidth = logoDrawHeight * aspectRatio;
        }
        
        const logoX = (1080 - logoWidth) / 2;
        
        ctx.drawImage(logoImage, logoX, logoY, logoWidth, logoDrawHeight);
    } else {
        // Fallback text
        ctx.fillStyle = CARD_COLOR;
        ctx.font = '600 28px "Manrope", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Green Party East Hampshire', 540, logoY + 60);
    }
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

function truncateText(ctx, text, maxWidth) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;
    
    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
}

// Download
function downloadImage() {
    const canvas = document.getElementById('eventCanvas');
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.download = `green-party-events-${date}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

