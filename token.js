    // Google Sheets API configuration
        const SPREADSHEET_ID = '11AWbKR2rR2YQYm6AdjEQsw-na9QObL0wfw6eAi4MEdM';
        const API_KEY = 'AIzaSyBAuS3Brpsw5JOJnjNJii1UlFa7ClXf8d4';
        const SHEET_NAME = '101';
        const SETTINGS_SHEET = 'settings';
        
        // Voice files configuration
        const VOICE_BASE_URL = 'https://itcelldto.github.io/try/apps/dt-token/voices/';
        
        // Store section voice files that have been loaded
        const sectionVoiceCache = new Map();
        
        // Audio cache for common voice files
        const audioCache = new Map();
        
        // Configuration for max tokens to show
        const MAX_TOKENS_TO_SHOW = {
            desktop: 6,
            tablet: 4,
            mobile: 3
        };
        
        // Store previous token data for comparison
        let previousTokenData = {};
        let previousAllPassedTokens = {}; // Track all passed tokens per section
        let fetchRetryCount = 0;
        const MAX_RETRIES = 3;
        
        // Preload notification bell sound
        const notificationBell = new Audio("https://itcelltreasury.github.io/try/bell.mp3");
        
        // Common voice files to preload - ONLY DIGIT FILES
        const COMMON_VOICE_FILES = [
            '0.wav', '1.wav', '2.wav', '3.wav', '4.wav',
            '5.wav', '6.wav', '7.wav', '8.wav', '9.wav',
            'token_no.wav'  // "token number" phrase
        ];
        
        // Preload common voice files
        function preloadCommonVoiceFiles() {
            console.log('Preloading common voice files...');
            COMMON_VOICE_FILES.forEach(filename => {
                const audio = new Audio();
                audio.src = VOICE_BASE_URL + filename;
                audio.preload = 'auto';
                audioCache.set(filename, audio);
                
                // Force load by playing and immediately pausing
                audio.load();
            });
            console.log('Common voice files preloading initiated');
        }
        
        // Extract section name and number
        function extractSectionParts(sectionName) {
            // Extract the last number from the section name
            const numberMatch = sectionName.match(/\d+$/);
            const sectionNumber = numberMatch ? numberMatch[0] : null;
            
            // Get section name without the number
            const baseSectionName = sectionNumber ? 
                sectionName.replace(new RegExp(`\\s*${sectionNumber}$`), '').trim() : 
                sectionName.trim();
            
            return {
                baseName: baseSectionName,
                number: sectionNumber
            };
        }
        
        // Load section voice file if not already loaded
        async function loadSectionVoice(sectionName) {
            const { baseName } = extractSectionParts(sectionName);
            
            // Convert to lowercase and create filename
            const fileName = baseName.toLowerCase().replace(/\s+/g, '_') + '.wav';
            
            // Check if already in cache
            if (sectionVoiceCache.has(fileName)) {
                return sectionVoiceCache.get(fileName);
            }
            
            // Create new audio element
            const audio = new Audio();
            audio.src = VOICE_BASE_URL + fileName;
            audio.preload = 'auto';
            
            // Load the audio file
            return new Promise((resolve, reject) => {
                audio.addEventListener('canplaythrough', () => resolve(audio));
                audio.addEventListener('error', () => {
                    console.warn(`Could not load voice file for section: ${baseName} (${fileName})`);
                    // Return null instead of rejecting
                    resolve(null);
                });
                audio.load();
            }).then(audio => {
                if (audio) {
                    sectionVoiceCache.set(fileName, audio);
                }
                return audio;
            });
        }
        
        // Play common voice file
        async function playCommonVoice(fileName) {
            return new Promise((resolve) => {
                const audio = audioCache.get(fileName);
                
                if (audio) {
                    audio.currentTime = 0;
                    audio.play().then(() => {
                        audio.onended = resolve;
                    }).catch(error => {
                        console.warn(`Could not play ${fileName}:`, error);
                        resolve();
                    });
                } else {
                    console.warn(`Voice file not found: ${fileName}`);
                    resolve();
                }
            });
        }
        
        // Play individual digit voice
        function playDigitVoice(digit) {
            return playCommonVoice(`${digit}.wav`);
        }
        
        // Play "token number" phrase
        async function playTokenNumberPhrase() {
            await playCommonVoice('token_no.wav');
        }
        
        // Play section voice with number (digit by digit)
        async function playSectionVoiceWithNumber(sectionName) {
            try {
                const { baseName, number } = extractSectionParts(sectionName);
                
                if (!baseName) return;
                
                // Play section name
                const fileName = baseName.toLowerCase().replace(/\s+/g, '_') + '.wav';
                const audio = sectionVoiceCache.get(fileName);
                
                if (audio) {
                    audio.currentTime = 0;
                    await audio.play();
                    await new Promise(resolve => audio.onended = resolve);
                } else {
                    console.warn(`Section voice file not loaded: ${fileName} for section ${sectionName}`);
                    // Fallback: try to load it now
                    const newAudio = await loadSectionVoice(sectionName);
                    if (newAudio) {
                        newAudio.currentTime = 0;
                        await newAudio.play();
                        await new Promise(resolve => newAudio.onended = resolve);
                    }
                }
                
                // If there's a number, play it digit by digit after the section name
                if (number) {
                    // Pause between section name and number
                    await new Promise(resolve => setTimeout(resolve, 150));
                    
                    // Play the number digit by digit (as in original HTML)
                    const numberDigits = number.toString().split('');
                    for (const digit of numberDigits) {
                        await playDigitVoice(digit);
                        // Small pause between digits
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
                
            } catch (error) {
                console.warn(`Could not play section voice for ${sectionName}:`, error);
            }
        }
        
        // Announce token in format: "Token number [digits] [section name] [section number]"
        async function announceToken(section, tokenNumber) {
            if (!audioCache.size) {
                console.warn('Voice files not loaded yet');
                return;
            }
            
            try {
                // Play "token number" phrase
                await playTokenNumberPhrase();
                
                // Pause before token number
                await new Promise(resolve => setTimeout(resolve, 150));
                
                // Announce token number digit by digit (AS IN ORIGINAL HTML)
                const tokenDigits = tokenNumber.toString().split('');
                
                // Play each digit separately
                for (const digit of tokenDigits) {
                    await playDigitVoice(digit);
                    // Small pause between digits
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                // Pause between token number and section
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Announce section name with number (digit by digit)
                await playSectionVoiceWithNumber(section);
                
            } catch (error) {
                console.error('Error in token announcement:', error);
            }
        }
        
        // Function to get max tokens to show based on screen width
        function getMaxTokensToShow() {
            const width = window.innerWidth;
            if (width <= 768) {
                return MAX_TOKENS_TO_SHOW.mobile;
            } else if (width <= 1200) {
                return MAX_TOKENS_TO_SHOW.tablet;
            } else {
                return MAX_TOKENS_TO_SHOW.desktop;
            }
        }
        
        // Function to fetch data from Google Sheets with error handling
        async function fetchTokenData() {
            try {
                const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                fetchRetryCount = 0; // Reset retry count on success
                return processData(data.values);
            } catch (error) {
                console.error('Error fetching data:', error);
                fetchRetryCount++;
                
                // If we have previous data and retries exceeded, use it
                if (Object.keys(previousTokenData).length > 0 && fetchRetryCount >= MAX_RETRIES) {
                    console.log('Using previously loaded data due to repeated failures');
                    return previousTokenData;
                }
                
                // Otherwise use fallback data
                if (fetchRetryCount >= MAX_RETRIES) {
                    console.log('Using fallback data');
                    return getFallbackData();
                }
                
                return null;
            }
        }
        
        // Generate fallback data
        function getFallbackData() {
            const fallbackData = {
                "Section 1": { currentToken: 25, queuedTokens: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35], passedTokens: new Set([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25]) },
                "Section 2": { currentToken: 18, queuedTokens: [19, 20, 21, 22, 23, 24], passedTokens: new Set([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]) },
                "Section 3": { currentToken: 32, queuedTokens: [], passedTokens: new Set([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32]) },
                "Section 4": { currentToken: 15, queuedTokens: [16, 17, 18, 19, 20, 21, 22, 23], passedTokens: new Set([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]) },
                "Section 5": { currentToken: 22, queuedTokens: [], passedTokens: new Set([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22]) }
            };
            return fallbackData;
        }
        
        // Process the data from Google Sheets
        function processData(values) {
            if (!values || values.length < 2) return getFallbackData();
            
            // Extract headers and rows
            const headers = values[0];
            const rows = values.slice(1);
            
            // Create a map to organize tokens by section
            const sectionsMap = {};
            
            // Process each row
            rows.forEach(row => {
                if (row.length < headers.length) return;
                
                const section = row[1]; // Column B: section
                const tokenNo = parseInt(row[2]); // Column C: tokenNo
                const status = row[5]; // Column F: status
                
                if (!section || !tokenNo) return;
                
                if (!sectionsMap[section]) {
                    sectionsMap[section] = {
                        currentToken: null,
                        queuedTokens: [],
                        passedTokens: new Set() // Track all passed tokens
                    };
                }
                
                if (status === 'Pass') {
                    // Add to passed tokens set
                    sectionsMap[section].passedTokens.add(tokenNo);
                    
                    // Update current token to the highest passed token
                    if (!sectionsMap[section].currentToken || tokenNo > sectionsMap[section].currentToken) {
                        sectionsMap[section].currentToken = tokenNo;
                    }
                } else if (status === 'In Que') {
                    // Only add to queued if not passed
                    if (!sectionsMap[section].passedTokens.has(tokenNo)) {
                        sectionsMap[section].queuedTokens.push(tokenNo);
                    }
                }
            });
            
            // Sort queued tokens for each section (filter out passed tokens)
            for (const section in sectionsMap) {
                sectionsMap[section].queuedTokens = sectionsMap[section].queuedTokens
                    .filter(token => !sectionsMap[section].passedTokens.has(token))
                    .sort((a, b) => a - b);
            }
            
            return Object.keys(sectionsMap).length > 0 ? sectionsMap : getFallbackData();
        }
        
        // Preload section voice files based on current sections
        async function preloadSectionVoices(sections) {
            console.log('Preloading section voice files...');
            
            // Get unique base section names
            const uniqueBaseSections = new Set();
            sections.forEach(section => {
                const { baseName } = extractSectionParts(section);
                if (baseName) {
                    uniqueBaseSections.add(baseName);
                }
            });
            
            // Load each unique base section voice
            for (const baseSection of uniqueBaseSections) {
                try {
                    await loadSectionVoice(baseSection);
                    console.log(`Loaded voice file for section type: ${baseSection}`);
                } catch (error) {
                    console.warn(`Could not load voice file for section type ${baseSection}:`, error);
                }
            }
            
            console.log('Section voice files preloading completed');
        }
        
        // Check for changes and announce if needed
        function checkForChangesAndAnnounce(newData) {
            if (!newData || Object.keys(previousTokenData).length === 0) {
                previousTokenData = JSON.parse(JSON.stringify(newData));
                // Initialize passed tokens tracking
                for (const section in newData) {
                    previousAllPassedTokens[section] = new Set();
                    if (newData[section].passedTokens) {
                        newData[section].passedTokens.forEach(token => {
                            previousAllPassedTokens[section].add(token);
                        });
                    }
                }
                return;
            }
            
            // Check each section for newly passed tokens
            for (const section in newData) {
                if (!previousAllPassedTokens[section]) {
                    previousAllPassedTokens[section] = new Set();
                }
                
                const newPassedTokens = newData[section].passedTokens || new Set();
                
                // Check for any newly passed tokens
                newPassedTokens.forEach(token => {
                    if (!previousAllPassedTokens[section].has(token)) {
                        // This is a newly passed token, announce it
                        console.log(`New token ${token} passed at ${section}`);
                        playNotificationBell().then(() => {
                            announceToken(section, token);
                        });
                        
                        // Add to our set of passed tokens
                        previousAllPassedTokens[section].add(token);
                    }
                });
            }
            
            // Update previous data
            previousTokenData = JSON.parse(JSON.stringify(newData));
        }
        
        // Play notification bell sound
        function playNotificationBell() {
            return new Promise((resolve) => {
                notificationBell.currentTime = 0;
                notificationBell.play();
                notificationBell.onended = resolve;
            });
        }
        
        // Sort sections - those with queue first, then those without
        function sortSections(sectionsData) {
            const sectionsWithQueue = [];
            const sectionsWithoutQueue = [];
            
            // Separate sections based on queue status
            for (const section in sectionsData) {
                if (sectionsData[section].queuedTokens && sectionsData[section].queuedTokens.length > 0) {
                    sectionsWithQueue.push(section);
                } else {
                    sectionsWithoutQueue.push(section);
                }
            }
            
            // Sort each group by section number
            const sortByNumber = (a, b) => {
                const numA = parseInt(a.replace(/\D/g, '')) || 0;
                const numB = parseInt(b.replace(/\D/g, '')) || 0;
                return numA - numB;
            };
            
            sectionsWithQueue.sort(sortByNumber);
            sectionsWithoutQueue.sort(sortByNumber);
            
            // Combine: sections with queue first, then sections without queue
            return [...sectionsWithQueue, ...sectionsWithoutQueue];
        }
        
        // Generate the HTML table from processed data
        function generateTable(data) {
            if (!data || Object.keys(data).length === 0) {
                return '<div class="error-message">No token data available</div>';
            }
            
            // Sort sections: with queue first, without queue last
            const sortedSections = sortSections(data);
            
            let html = `
                <table>
                    <thead>
                        <tr>
                            <th>Section</th>
                            <th>Current Token</th>
                            <th>In Queue</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            // Get max tokens to show based on current screen size
            const maxTokens = getMaxTokensToShow();
            
            // Iterate through sorted sections
            for (const section of sortedSections) {
                const sectionData = data[section];
                const hasQueue = sectionData.queuedTokens && sectionData.queuedTokens.length > 0;
                const rowClass = hasQueue ? '' : 'no-queue-row';
                
                // Create queued tokens HTML
                let queuedTokensHtml = '<div class="queued-tokens-container"><div class="queued-tokens-wrapper">';
                
                if (hasQueue) {
                    // Show only limited tokens based on screen size
                    const tokensToShow = sectionData.queuedTokens.slice(0, maxTokens);
                    const remainingTokens = sectionData.queuedTokens.length - maxTokens;
                    
                    tokensToShow.forEach(token => {
                        queuedTokensHtml += `<span class="queued-token">${token}</span>`;
                    });
                    
                    // Add "more" indicator if there are remaining tokens
                    if (remainingTokens > 0) {
                        queuedTokensHtml += `<span class="more-tokens-indicator" title="${remainingTokens} more tokens">+${remainingTokens}</span>`;
                    }
                } else {
                    queuedTokensHtml += '<span class="no-queue-message">No tokens in queue</span>';
                }
                
                queuedTokensHtml += '</div></div>';
                
                html += `
                    <tr class="${rowClass}">
                        <td style="font-size: 2.5vw; font-weight: bold;">${section}</td>
                        <td class="current-token">${sectionData.currentToken || '--'}</td>
                        <td>${queuedTokensHtml}</td>
                    </tr>
                `;
            }
            
            html += `
                    </tbody>
                </table>
            `;
            
            return html;
        }
        
        // Update the table with new data
        async function updateTable() {
            try {
                const data = await fetchTokenData();
                if (data) {
                    // Preload section voices if this is the first load
                    if (Object.keys(previousTokenData).length === 0) {
                        const sections = Object.keys(data);
                        await preloadSectionVoices(sections);
                    }
                    
                    checkForChangesAndAnnounce(data);
                    document.getElementById('token-table').innerHTML = generateTable(data);
                }
            } catch (error) {
                console.error('Error updating table:', error);
                // Show error but keep previous data
                if (Object.keys(previousTokenData).length > 0) {
                    document.getElementById('token-table').innerHTML = generateTable(previousTokenData);
                } else {
                    document.getElementById('token-table').innerHTML = 
                        '<div class="error-message">Connection error. Please check your network.</div>';
                }
            }
        }
        
        // Update date and time function
        function updateDateTime() {
            const now = new Date();
            
            // Format date: Day, DD Month YYYY
            const dateOptions = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            };
            const dateStr = now.toLocaleDateString('en-US', dateOptions);
            
            // Format time: HH:MM:SS
            const timeStr = now.toLocaleTimeString('en-US', { 
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            document.getElementById('date-display').textContent = dateStr;
            document.getElementById('time-display').textContent = timeStr;
        }
        
        // Update scroll reel content
        async function updateScrollReel() {
            try {
                const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SETTINGS_SHEET}!C2:C?key=${API_KEY}`;
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.json();
                    const content = processScrollReelData(data.values);
                    const container = document.getElementById('scroll-reel-container');
                    const contentElement = document.getElementById('scroll-reel-content');
                    
                    if (content && content.trim() !== '') {
                        contentElement.textContent = content;
                        container.style.display = 'block';
                    } else {
                        container.style.display = 'none';
                    }
                }
            } catch (error) {
                console.error('Error fetching scroll reel:', error);
                document.getElementById('scroll-reel-container').style.display = 'none';
            }
        }
        
        function processScrollReelData(values) {
            if (!values || values.length === 0) return null;
            
            let content = '';
            for (let i = 0; i < values.length; i++) {
                if (values[i] && values[i][0] && values[i][0].trim() !== '') {
                    content += values[i][0] + ' • ';
                }
            }
            
            if (content.endsWith(' • ')) {
                content = content.slice(0, -3);
            }
            
            return content;
        }
        
        // Initial load
        window.addEventListener('load', function() {
            // Preload voices first
            preloadCommonVoiceFiles();
            
            // Then update display elements
            updateDateTime();
            updateTable();
            updateScrollReel();
            
            // Set up periodic refresh
            setInterval(updateDateTime, 1000);
            setInterval(updateTable, 2000);
            setInterval(updateScrollReel, 30000);
            
            // Update table on window resize to adjust token display
            window.addEventListener('resize', function() {
                if (Object.keys(previousTokenData).length > 0) {
                    document.getElementById('token-table').innerHTML = generateTable(previousTokenData);
                }
            });
        });
