// Global variables
let rooms = [];
let bookings = [];

// DOM elements (will be set in DOMContentLoaded)
let roomsList, roomSelect, bookingForm, bookingsList, loadBookingsBtn, searchEmail, toast, toastMessage, toastClose;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements after DOM is loaded
    roomsList = document.getElementById('rooms-list');
    roomSelect = document.getElementById('room-select');
    bookingForm = document.getElementById('booking-form');
    bookingsList = document.getElementById('bookings-list');
    loadBookingsBtn = document.getElementById('load-bookings');
    searchEmail = document.getElementById('search-email');
    console.log('Debug: searchEmail element found:', !!searchEmail);
    if (searchEmail) {
        console.log('Debug: searchEmail.disabled:', searchEmail.disabled);
        console.log('Debug: searchEmail.readOnly:', searchEmail.readOnly);
        console.log('Debug: searchEmail.style.pointerEvents:', searchEmail.style.pointerEvents);
    }
    toast = document.getElementById('toast');
    toastMessage = document.getElementById('toast-message');
    toastClose = document.getElementById('toast-close');

    loadRooms();

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('booking-date').min = today;

    // Event listeners
    bookingForm.addEventListener('submit', handleBooking);
    console.log('Debug: Adding event listener to loadBookingsBtn');
    loadBookingsBtn.addEventListener('click', loadBookings);
    toastClose.addEventListener('click', hideToast);

    // Add event listener to searchEmail for Enter key
    if (searchEmail) {
        searchEmail.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                console.log('Debug: Enter key pressed on searchEmail, triggering loadBookings');
                loadBookings();
            }
        });
    }
});

// Load all rooms from the API
async function loadRooms() {
    try {
        console.log('loadRooms: Starting to fetch rooms from API');
        console.log('loadRooms: Checking if roomSelect element exists:', !!roomSelect);
        const response = await fetch('api.php?action=get_rooms');
        console.log('loadRooms: Response status:', response.status);
        console.log('loadRooms: Response headers:', response.headers);
        if (!response.ok) {
            console.error('loadRooms: HTTP error', response.status, response.statusText);
            console.log('loadRooms: Response text:', await response.text());
            showToast('Error loading rooms. Please try again.', 'error');
            return;
        }
        rooms = await response.json();
        console.log('loadRooms: Received rooms data:', rooms);
        console.log('loadRooms: Rooms array length:', rooms.length);
        if (rooms.length === 0) {
            console.log('loadRooms: No rooms loaded - room select will be empty');
            console.log('loadRooms: Possible causes: empty database table, SQL query error, or API response error');
        } else {
            console.log('loadRooms: Loaded', rooms.length, 'rooms');
            console.log('loadRooms: First room sample:', rooms[0]);
        }
        displayRooms();
        populateRoomSelect();
        console.log('loadRooms: populateRoomSelect called');
    } catch (error) {
        console.error('Error loading rooms:', error);
        console.log('loadRooms: Error type:', error.constructor.name);
        console.log('loadRooms: Error message:', error.message);
        showToast('Error loading rooms. Please try again.', 'error');
    }
}

// Display rooms in the rooms list
function displayRooms() {
    roomsList.innerHTML = '';
    
    rooms.forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200';
        roomCard.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-semibold text-lg text-gray-800">${room.name}</h3>
                    <p class="text-sm text-gray-600">${room.location}</p>
                </div>
                <span class="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">Capacity: ${room.capacity}</span>
            </div>
            <div class="mt-2">
                <p class="text-sm text-gray-700">${room.facilities}</p>
            </div>
        `;
        roomsList.appendChild(roomCard);
    });
}

// Populate the room select dropdown
function populateRoomSelect() {
    console.log('populateRoomSelect: Starting to populate room select');
    console.log('populateRoomSelect: Rooms array:', rooms);
    console.log('populateRoomSelect: roomSelect element:', roomSelect);

    if (!roomSelect) {
        console.error('populateRoomSelect: roomSelect element not found!');
        return;
    }

    roomSelect.innerHTML = '<option value="">Select a room</option>';

    if (rooms.length === 0) {
        console.log('populateRoomSelect: No rooms to populate - select will remain with default option only');
        return;
    }

    rooms.forEach((room, index) => {
        console.log(`populateRoomSelect: Adding room ${index}:`, room);
        if (!room.id || !room.name) {
            console.warn('populateRoomSelect: Room missing id or name:', room);
            return;
        }
        const option = document.createElement('option');
        option.value = room.id;
        option.textContent = `${room.name} (${room.location})`;
        roomSelect.appendChild(option);
    });

    console.log('populateRoomSelect: Room select populated successfully. Total options:', roomSelect.options.length);
}

// Handle booking form submission
async function handleBooking(e) {
    e.preventDefault();
    
    const roomId = roomSelect.value;
    const date = document.getElementById('booking-date').value;
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;
    const userName = document.getElementById('user-name').value;
    const userEmail = document.getElementById('user-email').value;
    const purpose = document.getElementById('purpose').value;
    
    // Validate form
    if (!roomId || !date || !startTime || !endTime || !userName || !userEmail || !purpose) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    // Validate time
    if (startTime >= endTime) {
        showToast('End time must be after start time', 'error');
        return;
    }
    
    try {
        // First check availability
        const availabilityResponse = await fetch('api.php?action=check_availability', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `room_id=${roomId}&date=${date}&start_time=${startTime}&end_time=${endTime}`
        });
        
        const availability = await availabilityResponse.json();
        
        if (!availability.available) {
            showToast('Room is not available for the selected time slot', 'error');
            return;
        }
        
        // Make booking
        const bookingResponse = await fetch('api.php?action=make_booking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `room_id=${roomId}&user_name=${encodeURIComponent(userName)}&user_email=${encodeURIComponent(userEmail)}&purpose=${encodeURIComponent(purpose)}&booking_date=${date}&start_time=${startTime}&end_time=${endTime}`
        });
        
        const result = await bookingResponse.json();
        
        if (result.success) {
            showToast('Room booked successfully!', 'success');
            bookingForm.reset();
            
            // If the user is viewing their bookings, reload them
            if (searchEmail.value === userEmail) {
                loadBookings();
            }
        } else {
            showToast(result.message || 'Booking failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error making booking:', error);
        showToast('Error making booking. Please try again.', 'error');
    }
}

// Load bookings for a specific email
async function loadBookings() {
    const email = searchEmail.value.trim();
    
    if (!email) {
        showToast('Please enter your email to view bookings', 'error');
        return;
    }
    
    try {
        const response = await fetch(`api.php?action=get_bookings&email=${encodeURIComponent(email)}`);
        bookings = await response.json();
        displayBookings();
    } catch (error) {
        console.error('Error loading bookings:', error);
        showToast('Error loading bookings. Please try again.', 'error');
    }
}

// Display bookings in the bookings list
function displayBookings() {
    bookingsList.innerHTML = '';
    
    if (bookings.length === 0) {
        bookingsList.innerHTML = '<p class="text-gray-500 text-center py-4">No bookings found</p>';
        return;
    }
    
    bookings.forEach(booking => {
        const bookingCard = document.createElement('div');
        bookingCard.className = `border rounded-lg p-4 ${booking.status === 'confirmed' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`;
        
        const bookingDate = new Date(booking.booking_date);
        const formattedDate = bookingDate.toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
        
        bookingCard.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-semibold text-gray-800">${booking.room_name}</h3>
                    <p class="text-sm text-gray-600">${booking.location}</p>
                </div>
                <span class="${booking.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} text-xs font-medium px-2.5 py-0.5 rounded">
                    ${booking.status}
                </span>
            </div>
            <div class="mt-2">
                <p class="text-sm text-gray-700"><i class="far fa-calendar mr-1"></i> ${formattedDate}</p>
                <p class="text-sm text-gray-700"><i class="far fa-clock mr-1"></i> ${booking.start_time} - ${booking.end_time}</p>
                <p class="text-sm text-gray-700 mt-1">${booking.purpose}</p>
            </div>
            ${booking.status === 'confirmed' ? `
            <div class="mt-3 text-right">
                <button onclick="cancelBooking(${booking.id})" class="text-red-600 hover:text-red-800 text-sm font-medium">
                    Cancel Booking
                </button>
            </div>
            ` : ''}
        `;
        bookingsList.appendChild(bookingCard);
    });
}

// Cancel a booking
async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) {
        return;
    }
    
    try {
        const response = await fetch('api.php?action=cancel_booking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `booking_id=${bookingId}`
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Booking cancelled successfully', 'success');
            loadBookings(); // Reload the bookings list
        } else {
            showToast('Failed to cancel booking', 'error');
        }
    } catch (error) {
        console.error('Error cancelling booking:', error);
        showToast('Error cancelling booking. Please try again.', 'error');
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    
    // Set color based on type
    if (type === 'success') {
        toast.className = 'fixed bottom-4 right-4 p-4 rounded-lg shadow-lg bg-green-500 text-white flex items-center';
    } else if (type === 'error') {
        toast.className = 'fixed bottom-4 right-4 p-4 rounded-lg shadow-lg bg-red-500 text-white flex items-center';
    } else {
        toast.className = 'fixed bottom-4 right-4 p-4 rounded-lg shadow-lg bg-blue-500 text-white flex items-center';
    }
    
    toast.classList.remove('hidden');
    
    // Auto hide after 5 seconds
    setTimeout(hideToast, 5000);
}

// Hide toast notification
function hideToast() {
    toast.classList.add('hidden');
}