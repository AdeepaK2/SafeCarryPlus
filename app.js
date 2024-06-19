let map;
let marker;
let temperatureLimit = 30; // Default temperature limit
let isViewingHistory = false;
let liveUpdateInterval;
let historyMarkers = []; // Define the historyMarkers array globally

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: -34.397, lng: 150.644 },
        zoom: 8
    });

    marker = new google.maps.Marker({
        map: map
    });

    fetchTemperatureLimit();
    fetchDataAndUpdate();
    liveUpdateInterval = setInterval(fetchDataAndUpdate, 1000); // Update every second
}

function fetchTemperatureLimit() {
    fetch('https://api.thingspeak.com/channels/2503888/feeds.json?api_key=U77JZBQJ80V6Y4G1&results=1')
        .then(response => response.json())
        .then(data => {
            const lastFeed = data.feeds[0];
            if (lastFeed && lastFeed.field6) {
                temperatureLimit = parseFloat(lastFeed.field6);
            } else {
                console.warn('Temperature limit not found in the fetched data. Using default value.');
            }
        })
        .catch(error => {
            console.error('Error fetching temperature limit:', error);
        });
}

function updateTemperatureLimit(newLimit) {
    temperatureLimit = newLimit;
    fetch(`https://api.thingspeak.com/update?api_key=UPXKBN7UMQ6BC8SW&field6=${temperatureLimit}`)
        .then(response => response.text())
        .then(data => {
            console.log('Temperature limit updated:', data);
        })
        .catch(error => {
            console.error('Error updating temperature limit:', error);
        });
}

function isValidNumber(value) {
    return !isNaN(value) && value !== null && value !== undefined;
}

function fetchDataAndUpdate() {
    fetch('https://api.thingspeak.com/channels/2503888/feeds.json?api_key=U77JZBQJ80V6Y4G1&results=10')
        .then(response => response.json())
        .then(data => {
            const feeds = data.feeds;
            const warningMessage = document.getElementById('warningMessage');
            const temperatureElement = document.getElementById('temperature');
            const humidityElement = document.getElementById('humidity');
            const movementElement = document.getElementById('movement');
            const lastOnlineElement = document.getElementById('lastOnline');

            let lastValidLocation = null;
            let lastValidTemperature = null;
            let lastValidHumidity = null;
            let lastValidSpeed = null;
            let lastValidTime = null;
            let allDataZero = true;
            let warnings = [];

            for (let i = feeds.length - 1; i >= 0; i--) {
                const feed = feeds[i];
                const latitude = parseFloat(feed.field1);
                const longitude = parseFloat(feed.field2);
                const temperature = parseFloat(feed.field3);
                const humidity = parseFloat(feed.field4);
                const speed = parseFloat(feed.field5);
                const created_at = new Date(feed.created_at).getTime();

                if (latitude !== 0 || longitude !== 0 || temperature !== 0 || humidity !== 0 || speed !== 0) {
                    allDataZero = false;
                }

                if (isValidNumber(latitude) && isValidNumber(longitude) && (latitude !== 0 || longitude !== 0) && !lastValidLocation) {
                    lastValidLocation = { lat: latitude, lng: longitude };
                }
                if (isValidNumber(temperature) && temperature !== 0 && !lastValidTemperature) {
                    lastValidTemperature = temperature;
                }
                if (isValidNumber(humidity) && humidity !== 0 && !lastValidHumidity) {
                    lastValidHumidity = humidity;
                }
                if (isValidNumber(speed) && speed !== 0 && !lastValidSpeed) {
                    lastValidSpeed = speed;
                }
                if (!lastValidTime) {
                    lastValidTime = created_at;
                }
            }

            const latestFeed = feeds[0];
            const latestLatitude = parseFloat(latestFeed.field1);
            const latestLongitude = parseFloat(latestFeed.field2);
            const latestTemperature = parseFloat(latestFeed.field3);
            const latestHumidity = parseFloat(latestFeed.field4);
            const latestSpeed = parseFloat(latestFeed.field5);
            const latestTime = new Date(latestFeed.created_at).getTime();

            if (isValidNumber(latestLatitude) && isValidNumber(latestLongitude) && (latestLatitude !== 0 || latestLongitude !== 0)) {
                lastValidLocation = { lat: latestLatitude, lng: latestLongitude };
            }

            if (lastValidLocation) {
                marker.setPosition(lastValidLocation);
                map.setCenter(lastValidLocation);
            }

            if (isValidNumber(latestLatitude) && isValidNumber(latestLongitude) && latestLatitude === 0 && latestLongitude === 0 && isValidNumber(latestTemperature) && latestTemperature !== 0 && isValidNumber(latestHumidity) && latestHumidity !== 0) {
                warnings.push('Location fetching unsuccessful. Device might be turned off. Displaying the last seen location.');
                temperatureElement.textContent = latestTemperature.toFixed(1);
                humidityElement.textContent = latestHumidity.toFixed(1);
                movementElement.textContent = latestSpeed > 2 ? 'Device is moving' : 'Device is stationary';
                lastOnlineElement.textContent = 'Last online: ' + new Date(lastValidTime).toLocaleString();
            } else if (allDataZero) {
                warnings.push('Device is turned off. Displaying last known data.');
                temperatureElement.textContent = lastValidTemperature ? lastValidTemperature.toFixed(1) : 'N/A';
                humidityElement.textContent = lastValidHumidity ? lastValidHumidity.toFixed(1) : 'N/A';
                movementElement.textContent = lastValidSpeed > 2 ? 'Device is moving' : 'Device is stationary';
                lastOnlineElement.textContent = 'Last online: ' + new Date(lastValidTime).toLocaleString();
            } else {
                temperatureElement.textContent = isValidNumber(latestTemperature) ? latestTemperature.toFixed(1) : 'N/A';
                humidityElement.textContent = isValidNumber(latestHumidity) ? latestHumidity.toFixed(1) : 'N/A';
                movementElement.textContent = latestSpeed > 2 ? 'Device is moving' : 'Device is stationary';

                const currentTimestamp = new Date().getTime();
                const timeDifference = (currentTimestamp - latestTime) / 1000 / 60; // Time difference in minutes

                if (timeDifference <= 4) {
                    lastOnlineElement.textContent = 'Device is online';
                } else {
                    lastOnlineElement.textContent = 'Device is offline. Last online: ' + new Date(latestTime).toLocaleString();
                }
            }

            if (latestTemperature > temperatureLimit) {
                warnings.push('Temperature exceeds safe limit!');
            }

            if (warnings.length > 0) {
                warningMessage.style.display = 'block';
                warningMessage.textContent = warnings.join(' ');
            } else {
                warningMessage.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            const warningMessage = document.getElementById('warningMessage');
            warningMessage.textContent = 'Error fetching data. Please try again later.';
            warningMessage.style.display = 'block';
        });
}

function fetchAndDisplayHistory() {
    const apiKey = 'U77JZBQJ80V6Y4G1';
    const channelId = '2503888';
    const results = 50; // Number of results to fetch

    const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${apiKey}&results=${results}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const feeds = data.feeds;
            clearHistoryMarkers();

            feeds.forEach(feed => {
                const latitude = parseFloat(feed.field1);
                const longitude = parseFloat(feed.field2);

                if (isValidNumber(latitude) && isValidNumber(longitude) && (latitude !== 0 || longitude !== 0)) {
                    const position = { lat: latitude, lng: longitude };
                    const historyMarker = new google.maps.Marker({
                        position,
                        map,
                        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' // Different icon for history markers
                    });
                    historyMarkers.push(historyMarker);
                }
            });

            if (historyMarkers.length > 0) {
                const bounds = new google.maps.LatLngBounds();
                historyMarkers.forEach(marker => bounds.extend(marker.getPosition()));
                map.fitBounds(bounds);
            } else {
                alert('No historical location data available.');
            }
        })
        .catch(error => {
            console.error('Error fetching historical data:', error);
            alert(`Error fetching historical data: ${error.message}`);
        });
}

function clearHistoryMarkers() {
    historyMarkers.forEach(marker => marker.setMap(null));
    historyMarkers = [];
}

function toggleView() {
    const toggleButton = document.getElementById('toggleViewButton');
    if (isViewingHistory) {
        // Switch to live view
        clearHistoryMarkers();
        fetchDataAndUpdate();
        liveUpdateInterval = setInterval(fetchDataAndUpdate, 1000);
        toggleButton.textContent = 'View Location History';
    } else {
        // Switch to history view
        clearInterval(liveUpdateInterval);
        fetchAndDisplayHistory();
        toggleButton.textContent = 'View Live Location';
    }
    isViewingHistory = !isViewingHistory;
}

document.getElementById('toggleViewButton').addEventListener('click', toggleView);

document.getElementById('settingsButton').addEventListener('click', () => {
    const newLimit = parseFloat(prompt("Please enter your preferred temperature limit:"));
    if (!isNaN(newLimit)) {
        updateTemperatureLimit(newLimit);
    }
});

// map init
google.maps.event.addDomListener(window, 'load', initMap);

document.addEventListener('DOMContentLoaded', () => {
    const loginDialog = document.getElementById('loginDialog');
    const loginButton = document.getElementById('loginButton');
    const loginMessage = document.getElementById('loginMessage');

    const adminUsername = 'admin';
    const adminPassword = 'admin123';

    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser) {
        loginDialog.showModal();
    }

    loginButton.addEventListener('click', () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (username === adminUsername && password === adminPassword) {
            localStorage.setItem('loggedInUser', username);
            loginMessage.textContent = 'Login successful!';
            loginDialog.close();
        } else {
            loginMessage.textContent = 'Invalid username or password.';
        }
    });
});








