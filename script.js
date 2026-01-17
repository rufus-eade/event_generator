// Calendar URLs with assigned colors
const CALENDAR_URLS = [
    {
        name: 'East Hampshire Green Party',
        url: 'https://ics.teamup.com/feed/ksz6j1axw1d997esiy/15203239.ics',
        color: '#00a85a' // Fair Green
    },
    {
        name: 'Local Events',
        url: 'https://ics.teamup.com/feed/ksz6j1axw1d997esiy/15203234.ics',
        color: '#001f4e' // Midnight
    },
    {
        name: 'National Events',
        url: 'https://ics.teamup.com/feed/ksz6j1axw1d997esiy/15203160.ics',
        color: '#00643b' // Forest Green
    }
];

const CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://cors-anywhere.herokuapp.com/'
];

// Card dimensions
const CARD_HEIGHT = 140; // Always use this height
const CARD_GAP = 20;

// Global state
let allEvents = [];
let selectedEvents = new Set();
let currentMonth = new Date();
let eventsByMonth = {};
let logoImage = null;
let fontsLoaded = false;
let canvasUpdateTimeout = null;
let headerImageDataUrl = null;

// Add this function to handle image upload
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file size (1MB max)
    if (file.size > 1 * 1024 * 1024) {
        showUploadStatus('File size exceeds 1MB limit.', 'error');
        return;
    }
    
    // Update UI
    document.getElementById('currentImageName').textContent = file.name;
    document.getElementById('useImageBtn').disabled = false;
    
    // Show preview and store as data URL
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('previewImage');
        preview.src = e.target.result;
        document.getElementById('imagePreview').style.display = 'block';
        
        // Store as data URL
        headerImageDataUrl = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Function to use uploaded image
function useUploadedImage() {
    if (!headerImageDataUrl) {
        showUploadStatus('No image selected', 'error');
        return;
    }
    
    showUploadStatus('Image loaded successfully!', 'success');
    document.getElementById('clearImageBtn').disabled = false;
    debouncedUpdateCanvas();
}

// Function to clear header image
function clearHeaderImage() {
    headerImageDataUrl = null;
    document.getElementById('currentImageName').textContent = 'No image selected';
    document.getElementById('useImageBtn').disabled = true;
    document.getElementById('clearImageBtn').disabled = true;
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('headerImageUpload').value = '';
    
    // Remove any upload status messages
    const statusElement = document.querySelector('.upload-status');
    if (statusElement) {
        statusElement.remove();
    }
    
    debouncedUpdateCanvas();
}

// Helper function to show upload status
function showUploadStatus(message, type) {
    // Remove existing status
    const existingStatus = document.querySelector('.upload-status');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    const statusElement = document.createElement('div');
    statusElement.className = `upload-status ${type}`;
    statusElement.textContent = message;
    
    const uploadControls = document.querySelector('.upload-controls');
    uploadControls.parentNode.insertBefore(statusElement, uploadControls.nextSibling);
    
    // Auto-remove success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (statusElement.parentNode) {
                statusElement.remove();
            }
        }, 3000);
    }
}

// Get calendar color by name
function getCalendarColor(calendarName) {
    const calendar = CALENDAR_URLS.find(c => c.name === calendarName);
    return calendar ? calendar.color : '#888888';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initCalendarStatus();
    initStyleListeners();
    loadFonts();
    loadLogo();
    loadCalendars();
    
    // Add image upload event listener
    const uploadInput = document.getElementById('headerImageUpload');
    if (uploadInput) {
        uploadInput.addEventListener('change', handleImageUpload);
    }
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

// Parse title to extract host from parentheses
function parseTitleAndHost(title) {
    const result = {
        title: title,
        host: null
    };
    
    const hostMatch = title.match(/\(([^)]+)\)/);
    if (hostMatch) {
        result.host = hostMatch[1];
        result.title = title.replace(/\s*\([^)]+\)\s*/, ' ').trim();
        result.title = result.title.replace(/[\s-:]+$/, '').trim();
    }
    
    return result;
}

// Extract URL from description
function extractUrlFromDescription(description) {
    if (!description) return null;
    
    // Try to find "Link:" pattern (new format)
    const linkMatch = description.match(/\n\nLink:\s*(\S+)/i);
    if (linkMatch && linkMatch[1]) {
        return linkMatch[1].trim();
    }
    
    // Also try "Link:" at the beginning of a line
    const linkMatch2 = description.match(/^Link:\s*(\S+)/im);
    if (linkMatch2 && linkMatch2[1]) {
        return linkMatch2[1].trim();
    }
    
    // Try older "Website Link / URL:" pattern
    const urlMatch = description.match(/Website Link \/ URL:\s*(\S+)/i);
    if (urlMatch && urlMatch[1]) {
        return urlMatch[1].trim();
    }
    
    // Look for any URL in the description
    const urlRegex = /(https?:\/\/[^\s<]+)/gi;
    const matches = description.match(urlRegex);
    if (matches && matches[0]) {
        return matches[0].trim();
    }
    
    return null;
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
        debouncedUpdateCanvas();
    }).catch(err => {
        console.error('Font loading failed:', err);
        fontsLoaded = true;
        debouncedUpdateCanvas();
    });
}

// Load logo image
function loadLogo() {
    logoImage = new Image();
    logoImage.crossOrigin = 'anonymous';
    logoImage.onload = () => {
        console.log('Logo loaded successfully');
        debouncedUpdateCanvas();
    };
    logoImage.onerror = (error) => {
        console.error('Failed to load logo:', error);
        const fallbackLogo = new Image();
        fallbackLogo.onload = () => {
            console.log('Fallback logo loaded');
            logoImage = fallbackLogo;
            debouncedUpdateCanvas();
        };
        fallbackLogo.onerror = () => {
            console.log('No logo available, using text fallback');
            logoImage = null;
            debouncedUpdateCanvas();
        };
        fallbackLogo.src = './assets/logo.jpg';
    };
    logoImage.src = 'assets/green-party_east-hampshire_long-left.jpg';
}

// Add debounced canvas update function
function debouncedUpdateCanvas() {
    if (canvasUpdateTimeout) {
        clearTimeout(canvasUpdateTimeout);
    }
    canvasUpdateTimeout = setTimeout(() => {
        updateCanvas();
        updateAltText();
        canvasUpdateTimeout = null;
    }, 100);
}

// Style change listeners
function initStyleListeners() {
    const styleInputs = ['canvasTitle'];
    styleInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', debouncedUpdateCanvas);
            element.addEventListener('input', debouncedUpdateCanvas);
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

// Filter out past events
function filterPastEvents(events) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    return events.filter(event => {
        if (!event.start) return false;
        
        if (event.allDay) {
            const eventDate = new Date(event.start);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate >= now;
        }
        
        return event.start >= now;
    });
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

// Fetch calendar with proxy support - UPDATED VERSION
function fetchCalendarWithProxies(url, proxyIndex) {
    return new Promise((resolve, reject) => {
        // Try direct fetch first (might work on same domain)
        fetch(url)
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
            .catch(() => {
                // If direct fetch fails, try your own proxy
                const proxyUrl = `https://calendar.ehgp.uk/event_generator/proxy.php?url=${encodeURIComponent(url)}`;
                
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
                        console.error('Proxy failed:', error);
                        // Fall back to public proxies if your proxy fails
                        if (proxyIndex >= CORS_PROXIES.length) {
                            reject(new Error('All proxies failed'));
                            return;
                        }

                        const publicProxy = CORS_PROXIES[proxyIndex];
                        let publicProxyUrl;
                        
                        if (publicProxy.includes('?')) {
                            publicProxyUrl = publicProxy + encodeURIComponent(url);
                        } else {
                            publicProxyUrl = publicProxy + url;
                        }
                        
                        fetch(publicProxyUrl)
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
                            .catch(finalError => {
                                console.error('All proxies failed:', finalError);
                                reject(finalError);
                            });
                    });
            });
    });
}

function reloadCalendars() {
    initCalendarStatus();
    loadCalendars();
}

function finalizeLoading() {
    // Filter out past events
    allEvents = filterPastEvents(allEvents);
    
    // Sort all events by date
    allEvents.sort((a, b) => {
        if (!a.start) return 1;
        if (!b.start) return -1;
        return a.start - b.start;
    });

    // Remove duplicates based on title + start time + calendar
    const seen = new Map();
    allEvents = allEvents.filter(event => {
        const key = `${event.title}-${event.start?.getTime()}-${event.calendar}`;
        if (seen.has(key)) {
            console.log('Removing duplicate event:', event.title);
            return false;
        }
        seen.set(key, true);
        return true;
    });

    // Group by month
    groupEventsByMonth();

    // Set current month to first future event or current month
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const futureEvent = allEvents.find(e => e.start && e.start >= now);
    if (futureEvent) {
        currentMonth = new Date(futureEvent.start.getFullYear(), futureEvent.start.getMonth(), 1);
    } else if (allEvents.length > 0 && allEvents[0].start) {
        currentMonth = new Date(allEvents[0].start.getFullYear(), allEvents[0].start.getMonth(), 1);
    } else {
        currentMonth = new Date();
    }

    renderMonthNav();
    renderEventsList();
    updateSelectedCount();
    debouncedUpdateCanvas();
    
    // Update status to show total events
    document.querySelectorAll('.status-item').forEach((item, index) => {
        const calendar = CALENDAR_URLS[index];
        if (calendar) {
            const count = allEvents.filter(e => e.calendar === calendar.name).length;
            updateCalendarStatus(index, 'success', `${calendar.name}: ${count} events`);
        }
    });
}

// ICS Parsing - UPDATED WITH BETTER RRULE HANDLING
function parseICSContent(content, calendarName) {
    const events = [];
    
    const rawLines = content.split(/\r?\n/);
    const lines = [];
    
    // Unfold lines
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
    let recurrenceRule = null;

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
                calendar: calendarName,
                host: null,
                eventUrl: null,
                recurrenceRule: null
            };
            recurrenceRule = null;
            continue;
        }
        
        if (line === 'END:VEVENT') {
            if (currentEvent && (currentEvent.title || currentEvent.start)) {
                if (!currentEvent.title) {
                    currentEvent.title = '(No title)';
                }
                
                const parsedTitle = parseTitleAndHost(currentEvent.title);
                currentEvent.title = parsedTitle.title;
                currentEvent.host = parsedTitle.host || calendarName;
                
                // Extract URL but keep the full description intact
                currentEvent.eventUrl = extractUrlFromDescription(currentEvent.description);
                
                events.push(currentEvent);
                
                // Generate recurring events if RRULE exists
                if (recurrenceRule && currentEvent.start) {
                    const recurringEvents = generateRecurringEvents(currentEvent, recurrenceRule);
                    events.push(...recurringEvents);
                }
            }
            currentEvent = null;
            recurrenceRule = null;
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
            case 'URL':
                if (!currentEvent.eventUrl) {
                    currentEvent.eventUrl = unescapeICS(value);
                }
                break;
            case 'RRULE':
                recurrenceRule = value;
                break;
        }
    }

    return events;
}

// Function to generate recurring events with PROPER RRULE handling
function generateRecurringEvents(event, rrule) {
    const recurringEvents = [];
    
    try {
        // Parse RRULE parameters
        const params = {};
        rrule.split(';').forEach(param => {
            const [key, value] = param.split('=');
            if (key && value) {
                params[key] = value;
            }
        });
        
        if (!params.FREQ || !event.start) return recurringEvents;
        
        const freq = params.FREQ;
        const count = params.COUNT ? parseInt(params.COUNT) : 12; // Default to 12 occurrences
        const interval = params.INTERVAL ? parseInt(params.INTERVAL) : 1;
        const byday = params.BYDAY;
        const until = params.UNTIL ? parseRRULEDate(params.UNTIL) : null;
        
        let currentDate = new Date(event.start);
        const originalHours = event.start.getHours();
        const originalMinutes = event.start.getMinutes();
        const originalSeconds = event.start.getSeconds();
        
        // Generate recurring events
        for (let i = 1; i < count; i++) {
            let nextDate;
            
            // Calculate next date based on frequency and rules
            if (byday && freq === 'MONTHLY') {
                // Handle monthly by day (e.g., "2TH" for 2nd Thursday)
                nextDate = calculateMonthlyByDayWithPosition(event.start, byday, i, interval);
            } else {
                // Simple recurrence based on frequency
                nextDate = new Date(currentDate);
                switch (freq) {
                    case 'DAILY':
                        nextDate.setDate(nextDate.getDate() + interval);
                        break;
                    case 'WEEKLY':
                        nextDate.setDate(nextDate.getDate() + (7 * interval));
                        break;
                    case 'MONTHLY':
                        nextDate.setMonth(nextDate.getMonth() + interval);
                        break;
                    case 'YEARLY':
                        nextDate.setFullYear(nextDate.getFullYear() + interval);
                        break;
                    default:
                        return recurringEvents;
                }
            }
            
            if (!nextDate) continue;
            
            // Preserve the original time
            nextDate.setHours(originalHours, originalMinutes, originalSeconds, 0);
            
            // Check if we've passed the UNTIL date
            if (until && nextDate > until) {
                break;
            }
            
            // Create new event with proper time preservation
            const newEvent = {
                ...event,
                start: new Date(nextDate),
                end: event.end ? new Date(event.end.getTime() + (nextDate.getTime() - event.start.getTime())) : null
            };
            
            // Make sure it's a unique object
            newEvent.id = `${event.title}-${nextDate.getTime()}`;
            
            // Only include events in the future
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const eventDate = new Date(newEvent.start);
            eventDate.setHours(0, 0, 0, 0);
            
            if (eventDate >= now) {
                recurringEvents.push(newEvent);
            }
            
            // Stop if we've generated enough future events
            if (recurringEvents.length >= 24) { // Limit to 24 future occurrences
                break;
            }
            
            currentDate = nextDate;
        }
    } catch (error) {
        console.error('Error generating recurring events:', error, rrule);
    }
    
    return recurringEvents;
}

// Parse RRULE date (YYYYMMDD or YYYYMMDDTHHMMSSZ)
function parseRRULEDate(dateStr) {
    if (!dateStr) return null;
    
    try {
        if (dateStr.includes('T')) {
            // Has time component
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1;
            const day = parseInt(dateStr.substring(6, 8));
            const hour = parseInt(dateStr.substring(9, 11)) || 0;
            const minute = parseInt(dateStr.substring(11, 13)) || 0;
            const second = parseInt(dateStr.substring(13, 15)) || 0;
            
            if (dateStr.endsWith('Z')) {
                return new Date(Date.UTC(year, month, day, hour, minute, second));
            } else {
                return new Date(year, month, day, hour, minute, second);
            }
        } else {
            // Date only
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1;
            const day = parseInt(dateStr.substring(6, 8));
            return new Date(year, month, day);
        }
    } catch (e) {
        console.error('Error parsing RRULE date:', dateStr, e);
        return null;
    }
}

// Calculate monthly by day with position (e.g., "2TH" for 2nd Thursday)
function calculateMonthlyByDayWithPosition(startDate, byday, occurrence, interval) {
    try {
        // Parse BYDAY - can be like "2TH" (2nd Thursday) or "-1SU" (last Sunday)
        const match = byday.match(/(-?\d+)?([A-Z]{2})/);
        if (!match) return null;
        
        const positionStr = match[1];
        const dayStr = match[2];
        const position = positionStr ? parseInt(positionStr) : 1; // Default to 1st if no position
        const targetDay = dayStringToNumber(dayStr);
        
        // Calculate base month
        const baseMonth = startDate.getMonth();
        const baseYear = startDate.getFullYear();
        
        // Calculate target month
        const monthOffset = occurrence * interval;
        const targetDate = new Date(baseYear, baseMonth + monthOffset, 1);
        
        // Get the position-th occurrence of the target day in the month
        return getNthWeekdayInMonth(targetDate.getFullYear(), targetDate.getMonth(), targetDay, position);
        
    } catch (error) {
        console.error('Error calculating monthly by day:', error);
        return null;
    }
}

// Helper function to get the nth weekday in a month
function getNthWeekdayInMonth(year, month, targetDay, n) {
    // targetDay: 0=Sunday, 1=Monday, ..., 6=Saturday
    // n: 1=1st, 2=2nd, 3=3rd, 4=4th, -1=last, -2=second to last, etc.
    
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    
    if (n > 0) {
        // Positive position (1st, 2nd, 3rd, 4th)
        // Calculate first occurrence
        let diff = (targetDay - firstDayOfWeek + 7) % 7;
        const date = new Date(year, month, 1 + diff);
        
        // Add (n-1) weeks
        date.setDate(date.getDate() + ((n - 1) * 7));
        
        // Check if we're still in the same month
        if (date.getMonth() === month) {
            return date;
        }
    } else if (n < 0) {
        // Negative position (last, second to last, etc.)
        // Get last day of month
        const lastDay = new Date(year, month + 1, 0);
        const lastDayOfWeek = lastDay.getDay();
        
        // Calculate last occurrence
        let diff = (lastDayOfWeek - targetDay + 7) % 7;
        const date = new Date(year, month, lastDay.getDate() - diff);
        
        // Go back if needed (e.g., -2 means second to last)
        date.setDate(date.getDate() + ((n + 1) * 7));
        
        // Check if we're still in the same month
        if (date.getMonth() === month) {
            return date;
        }
    }
    
    return null;
}

// Helper function to convert day string to number (SU=0, MO=1, ..., SA=6)
function dayStringToNumber(dayStr) {
    const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    return days.indexOf(dayStr.toUpperCase());
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

// Improved time formatting for start to end
function formatTimeRange(event) {
    if (!event.start) return '';
    
    if (event.allDay) {
        return 'All day';
    }
    
    const startTime = formatTimeForCanvas(event.start);
    
    if (event.end) {
        const endTime = formatTimeForCanvas(event.end);
        return `${startTime} - ${endTime}`;
    }
    
    return startTime;
}

// Format time range with host for display
function formatTimeRangeWithHost(event) {
    const timeStr = formatTimeRange(event);
    
    if (event.host && event.host !== event.calendar) {
        return `${timeStr}  (${event.host})`;
    }
    
    return timeStr;
}

// Event list rendering
function renderEventsList() {
    const container = document.getElementById('eventsList');
    const currentKey = getMonthKey(currentMonth);
    const eventIndices = eventsByMonth[currentKey] || [];
    
    if (allEvents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No events loaded. Click "Reload Calendars" to try again.</p>
            </div>
        `;
        return;
    }
    
    if (eventIndices.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No events in ${getMonthLabel(currentMonth)}</p>
                <p style="margin-top: 10px; font-size: 0.9rem; color: #666;">
                    Try selecting a different month from the quick navigation above.
                </p>
            </div>
        `;
        return;
    }

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
            const timeStr = formatTimeRangeWithHost(event);
            const calendarColor = getCalendarColor(event.calendar);
            
            html += `
                <div class="event-item ${selectedEvents.has(index) ? 'selected' : ''}" 
                     onclick="toggleEvent(${index})"
                     data-event-id="${index}">
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

// Format date for alt text (e.g., "17th January 2026")
function formatDateForAltText(date) {
    if (!date) return '';
    
    const day = date.getDate();
    const daySuffix = getDaySuffix(day);
    const month = date.toLocaleDateString('en-GB', { month: 'long' });
    const year = date.getFullYear();
    
    return `${day}${daySuffix} ${month} ${year}`;
}

// Helper function for day suffix (1st, 2nd, 3rd, etc.)
function getDaySuffix(day) {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        selectAllInMonth();
    }
    
    if (e.key === 'Escape') {
        deselectAll();
    }
    
    if (e.key === 'ArrowLeft') {
        previousMonth();
    } else if (e.key === 'ArrowRight') {
        nextMonth();
    }
});

// Event selection functions
function toggleEvent(index) {
    if (selectedEvents.has(index)) {
        selectedEvents.delete(index);
    } else {
        selectedEvents.add(index);
    }
    renderEventsList();
    updateSelectedCount();
    debouncedUpdateCanvas();
}

function selectAllInMonth() {
    const currentKey = getMonthKey(currentMonth);
    const eventIndices = eventsByMonth[currentKey] || [];
    eventIndices.forEach(index => selectedEvents.add(index));
    renderEventsList();
    updateSelectedCount();
    debouncedUpdateCanvas();
}

function deselectAll() {
    selectedEvents.clear();
    renderEventsList();
    updateSelectedCount();
    debouncedUpdateCanvas();
}

// Select upcoming events from East Hampshire Green Party calendar
function selectUpcomingEHGP() {
    deselectAll(); // Clear any existing selections
    
    // Get events from East Hampshire Green Party calendar only
    const ehgpEvents = allEvents.filter(event => 
        event.calendar === 'East Hampshire Green Party'
    );
    
    // Sort by date (earliest first)
    const sortedEHGPEvents = ehgpEvents.sort((a, b) => {
        if (!a.start) return 1;
        if (!b.start) return -1;
        return a.start - b.start;
    });
    
    // Select the next 6 events
    let selectedCount = 0;
    for (let i = 0; i < sortedEHGPEvents.length && selectedCount < 6; i++) {
        const event = sortedEHGPEvents[i];
        const eventIndex = allEvents.indexOf(event);
        
        if (eventIndex !== -1) {
            selectedEvents.add(eventIndex);
            selectedCount++;
        }
    }
    
    // Navigate to the month of the first selected event if available
    if (selectedCount > 0) {
        const firstEventIndex = Array.from(selectedEvents)[0];
        const firstEvent = allEvents[firstEventIndex];
        
        if (firstEvent && firstEvent.start) {
            // Go to the month of the first event
            const eventMonth = new Date(firstEvent.start.getFullYear(), firstEvent.start.getMonth(), 1);
            const currentKey = getMonthKey(currentMonth);
            const eventKey = getMonthKey(eventMonth);
            
            if (currentKey !== eventKey) {
                currentMonth = eventMonth;
                renderMonthNav();
            }
        }
    }
    
    renderEventsList();
    updateSelectedCount();
    debouncedUpdateCanvas();
    
    // Optional: Keep alert only when no events are found
    const count = selectedEvents.size;
    if (count === 0) {
        alert('No upcoming events found for East Hampshire Green Party');
    }
    // Removed the success alert
}

function updateSelectedCount() {
    const count = selectedEvents.size;
    document.getElementById('selectedCount').textContent = 
        count === 0 ? 'No events selected' : 
        count === 1 ? '1 event selected' : 
        `${count} events selected`;
}

// Generate alt text for selected events
function generateAltText() {
    const canvasTitle = document.getElementById('canvasTitle').value || 'Green events across East Hampshire';
    const selected = Array.from(selectedEvents)
        .map(i => allEvents[i])
        .filter(e => e)
        .sort((a, b) => {
            if (!a.start) return 1;
            if (!b.start) return -1;
            return a.start - b.start;
        });

    if (selected.length === 0) {
        return 'No events selected. Please select events to generate an image.';
    }

    let altText = `${canvasTitle}\n\n`;
    
    // Limit to 6 events
    const eventsToInclude = selected.slice(0, 6);
    
    eventsToInclude.forEach((event, index) => {
        const dateStr = event.start ? formatDateForAltText(event.start) : 'Date TBC';
        let timeStr = '';
        
        if (event.allDay) {
            timeStr = 'All day';
        } else if (event.start) {
            timeStr = formatTimeForCanvas(event.start);
            if (event.end) {
                timeStr += ' - ' + formatTimeForCanvas(event.end);
            }
        }
        
        altText += `${event.title}\n`;
        altText += `When: ${dateStr}, ${timeStr}\n`;
        
        if (event.location) {
            altText += `Where: ${event.location}\n`;
        }
        
        if (event.host && event.host !== event.calendar) {
            altText += `Host: ${event.host}\n`;
        }
        
        // Extract and display link from description if available
        let linkText = '';
        let cleanedDescription = '';
        
        if (event.description && event.description.trim()) {
            let description = event.description.trim();
            
            // Extract link from description (looking for "Link:" pattern)
            const linkMatch = description.match(/\n\nLink:\s*(.+?)(?:\n\n|$)/i);
            if (linkMatch && linkMatch[1]) {
                linkText = linkMatch[1].trim();
            } else {
                // Also try with just Link: at the beginning of a line
                const linkMatch2 = description.match(/^Link:\s*(.+?)(?:\n|$)/im);
                if (linkMatch2 && linkMatch2[1]) {
                    linkText = linkMatch2[1].trim();
                }
            }
            
            // Clean the description by removing unwanted sections
            // Remove \n\nWho: sections
            description = description.replace(/\n\nWho:\s*.+?(?:\n\n|$)/gi, '');
            
            // Remove \n\nLink: sections (but we already extracted the link)
            description = description.replace(/\n\nLink:\s*.+?(?:\n\n|$)/gi, '');
            
            // Remove any "Link:" at the beginning of the description
            description = description.replace(/^Link:\s*.+?(?:\n|$)/im, '');
            
            // Remove any "Who:" at the beginning of the description
            description = description.replace(/^Who:\s*.+?(?:\n|$)/im, '');
            
            // Remove "Website Link / URL:" prefixes
            description = description.replace(/Website Link \/ URL:\s*/gi, '');
            
            // Clean up any leftover double newlines
            description = description.replace(/\n\n+/g, '\n').trim();
            
            // Clean up leading/trailing whitespace and colons
            description = description.replace(/^[:.\s]+|[:.\s]+$/g, '');
            
            cleanedDescription = description;
        }
        
        // Show the link if we found one in the description
        if (linkText) {
            altText += `Link: ${linkText}\n`;
        } else if (event.eventUrl) {
            // Fall back to the extracted URL if no Link: text was found
            let cleanUrl = event.eventUrl;
            if (cleanUrl.toLowerCase().includes('website link / url:')) {
                cleanUrl = cleanUrl.replace(/Website Link \/ URL:\s*/i, '');
            }
            altText += `Link: ${cleanUrl}\n`;
        }
        
        // Add cleaned event description (if it still has content after cleaning)
        if (cleanedDescription && cleanedDescription.trim()) {
            altText += `Info: ${cleanedDescription}\n`;
        }
        
        if (index < eventsToInclude.length - 1) {
            altText += '\n';
        }
    });
    
    altText += `\nFind more Green events at https://calendar.ehgp.uk`;
    
    return altText;
}

// Update alt text in textarea
function updateAltText() {
    const altText = generateAltText();
    document.getElementById('altText').value = altText;
}

// Copy alt text to clipboard
function copyAltText() {
    const altTextArea = document.getElementById('altText');
    const copyButton = document.querySelector('.alt-text-header .btn');
    
    altTextArea.select();
    altTextArea.setSelectionRange(0, 99999);
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            const originalText = copyButton.textContent;
            copyButton.textContent = 'Copied!';
            copyButton.classList.add('copy-success');
            
            setTimeout(() => {
                copyButton.textContent = originalText;
                copyButton.classList.remove('copy-success');
            }, 2000);
        }
    } catch (err) {
        navigator.clipboard.writeText(altTextArea.value).then(() => {
            const originalText = copyButton.textContent;
            copyButton.textContent = 'Copied!';
            copyButton.classList.add('copy-success');
            
            setTimeout(() => {
                copyButton.textContent = originalText;
                copyButton.classList.remove('copy-success');
            }, 2000);
        }).catch(err => {
            console.error('Clipboard API failed:', err);
            alert('Failed to copy text to clipboard. Please select and copy manually.');
        });
    }
}

// Calculate total height needed for events
function calculateTotalEventsHeight(events) {
    let totalHeight = 0;
    events.forEach(event => {
        totalHeight += CARD_HEIGHT + CARD_GAP;
    });
    if (events.length > 0) {
        totalHeight -= CARD_GAP;
    }
    return totalHeight;
}

// Calculate how many events can fit - FIXED to allow up to 6 events
function calculateEventsToShow(events, availableHeight) {
    let totalHeight = 0;
    let count = 0;
    
    // We want to show up to 6 events maximum
    const maxEvents = 6;
    
    for (const event of events) {
        // If we already have 6 events, stop
        if (count >= maxEvents) break;
        
        const neededHeight = totalHeight + CARD_HEIGHT + (count > 0 ? CARD_GAP : 0);
        
        // If this event doesn't fit, stop
        if (neededHeight > availableHeight) {
            break;
        }
        
        totalHeight = neededHeight;
        count++;
    }
    
    return count;
}

function updateCanvas() {
    const canvas = document.getElementById('eventCanvas');
    const ctx = canvas.getContext('2d');
    
    if (!fontsLoaded) {
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#999999';
        ctx.font = '500 28px "Manrope", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Loading fonts...', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    const canvasTitle = document.getElementById('canvasTitle').value;

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

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const padding = 60;
    let headerHeight = padding;
    
    // Title (Bebas Neue) - ALWAYS show title first
    if (canvasTitle) {
        ctx.fillStyle = '#00a85a';
        ctx.font = '72px "Bebas Neue", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(canvasTitle.toUpperCase(), canvas.width / 2, headerHeight + 70);
        headerHeight += 100;
    }

    // Check if we have a header image - AFTER TITLE
    const hasHeaderImage = headerImageDataUrl;
    
    if (hasHeaderImage) {
        // Create image object from data URL
        const headerImage = new Image();
        headerImage.src = headerImageDataUrl;
        
        // Header image height - REDUCED to leave more space for events
        const headerImageHeight = ( CARD_HEIGHT * 2 ) + CARD_GAP; 
        
        // Draw the image directly from data URL
        drawHeaderImageFromData(ctx, padding, headerHeight, headerImageHeight, headerImage);
        headerHeight += headerImageHeight + 20; // Reduced spacing below image
    }

    const logoHeight = 180;
    const logoMargin = 40; // Normal margin
    const availableHeight = canvas.height - headerHeight - logoHeight - logoMargin;

    if (selected.length === 0) {
        ctx.fillStyle = '#999999';
        ctx.font = '500 28px "Manrope", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Select events to display', canvas.width / 2, headerHeight + availableHeight / 2);
    } else {
        // Always try to show up to 6 events
        const maxEventsAllowed = 6;
        const eventsToTry = selected.slice(0, maxEventsAllowed);
        const eventsThatCanFit = calculateEventsToShow(eventsToTry, availableHeight);
        const eventsToShow = selected.slice(0, Math.min(eventsThatCanFit, maxEventsAllowed));
        
        if (eventsToShow.length > 0) {
            const totalEventsHeight = calculateTotalEventsHeight(eventsToShow);
            const startY = headerHeight + (availableHeight - totalEventsHeight) / 2;
            
            // Draw event cards WITHOUT "+ X more events" message
            drawEventCards(ctx, eventsToShow, startY, padding);
        }
    }

    drawLogo(ctx, padding, logoHeight);
}

// Function to draw header image from data URL - UPDATED WITH BETTER SPACING
function drawHeaderImageFromData(ctx, padding, startY, height, imageObj) {
    const cardWidth = 1080 - (padding * 2);
    const x = padding;
    
    // Wait for image to load
    if (!imageObj.complete) {
        // Draw a placeholder if image hasn't loaded yet
        ctx.fillStyle = '#f0f0f0';
        roundRect(ctx, x, startY, cardWidth, height, 16, true, false);
        ctx.fillStyle = '#999';
        ctx.font = '500 24px "Manrope", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Loading image...', x + cardWidth/2, startY + height/2);
        return;
    }
    
    // Create clipping path for rounded corners
    ctx.save();
    roundRect(ctx, x, startY, cardWidth, height, 12, false, false); // Smaller radius
    ctx.clip();
    
    // Calculate image dimensions to fill the space (cropped to fit)
    const imageAspectRatio = imageObj.naturalWidth / imageObj.naturalHeight;
    const containerAspectRatio = cardWidth / height;
    
    let drawWidth, drawHeight, drawX, drawY;
    
    if (imageAspectRatio > containerAspectRatio) {
        // Image is wider than container, fit to height
        drawHeight = height;
        drawWidth = drawHeight * imageAspectRatio;
        drawX = x - (drawWidth - cardWidth) / 2;
        drawY = startY;
    } else {
        // Image is taller than container, fit to width
        drawWidth = cardWidth;
        drawHeight = drawWidth / imageAspectRatio;
        drawX = x;
        drawY = startY - (drawHeight - height) / 2;
    }
    
    // Draw the image
    ctx.drawImage(imageObj, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
    
    // Add a subtle border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1; // Thinner border
    roundRect(ctx, x, startY, cardWidth, height, 12, false, true);
}

function drawEventCards(ctx, events, startY, padding) {
    let y = startY;
    
    events.forEach((event) => {
        const cardWidth = 1080 - (padding * 2);
        const x = padding;
        
        const cardColor = getCalendarColor(event.calendar);
        ctx.fillStyle = cardColor;
        roundRect(ctx, x, y, cardWidth, CARD_HEIGHT, 16, true, false);
        
        const badgeWidth = 140;
        const badgeHeight = 90;
        const badgeX = x + 20;
        const badgeY = y + (CARD_HEIGHT - badgeHeight) / 2;
        
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 12, true, false);
        
        const day = event.start.getDate();
        const month = event.start.toLocaleDateString('en-GB', { month: 'short' });
        
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'center';
        
        ctx.font = '52px "Bebas Neue", sans-serif';
        ctx.fillText(day.toString(), badgeX + badgeWidth / 2, badgeY + 50);
        
        ctx.font = '600 22px "Manrope", sans-serif';
        ctx.fillText(month, badgeX + badgeWidth / 2, badgeY + 78);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 32px "Manrope", sans-serif';
        ctx.textAlign = 'left';
        const titleX = badgeX + badgeWidth + 30;
        const titleMaxWidth = cardWidth - badgeWidth - 100;
        
        // Fixed positions - always the same regardless of location
        const titleY = y + 45;
        const timeY = y + 80;
        const locationY = y + 115; // Always reserve space for location
        
        ctx.fillText(truncateText(ctx, event.title, titleMaxWidth), titleX, titleY);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '500 24px "Manrope", sans-serif';
        
        const timeText = formatTimeRangeWithHost(event);
        ctx.fillText(truncateText(ctx, timeText, titleMaxWidth), titleX, timeY);
        
        if (event.location) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = '500 22px "Manrope", sans-serif';
            ctx.fillText(truncateText(ctx, event.location, titleMaxWidth), titleX, locationY);
        }
        // If no location, the space is just left blank (consistent spacing)
        
        ctx.textAlign = 'left';
        y += CARD_HEIGHT + CARD_GAP;
    });
}

function drawLogo(ctx, padding, logoHeight) {
    const logoY = 1350 - logoHeight - 40;
    
    if (logoImage && logoImage.complete && logoImage.naturalWidth > 0) {
        const maxWidth = 600;
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
        ctx.fillStyle = '#00a85a';
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
    try {
        const canvas = document.getElementById('eventCanvas');
        if (!canvas) throw new Error('Canvas not found');
        
        const link = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        const title = document.getElementById('canvasTitle').value || 'events';
        const filename = `ehgp-${title.toLowerCase().replace(/\s+/g, '-')}-${date}.png`;
        
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        console.log('Image downloaded successfully:', filename);
    } catch (error) {
        console.error('Failed to download image:', error);
        alert('Failed to download image. Please try again.');
    }
}