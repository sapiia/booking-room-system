<?php
header('Content-Type: application/json');
require_once 'config.php';

$action = $_GET['action'] ?? '';

error_log("API called with action: " . $action);

try {
    switch($action) {
        case 'get_rooms':
            getRooms();
            break;
        case 'check_availability':
            checkAvailability();
            break;
        case 'make_booking':
            makeBooking();
            break;
        case 'get_bookings':
            getBookings();
            break;
        case 'cancel_booking':
            cancelBooking();
            break;
        default:
            error_log("Invalid action requested: " . $action);
            echo json_encode(['error' => 'Invalid action']);
    }
} catch(Exception $e) {
    error_log("Exception in API: " . $e->getMessage());
    echo json_encode(['error' => $e->getMessage()]);
}

function getRooms() {
    global $pdo;
    try {
        error_log("getRooms: Checking database connection");
        error_log("getRooms: Executing query: SELECT * FROM rooms ORDER BY name");
        $stmt = $pdo->query("SELECT * FROM rooms ORDER BY name");
        $rooms = $stmt->fetchAll(PDO::FETCH_ASSOC);
        error_log("getRooms: Query executed successfully");
        error_log("getRooms: Found " . count($rooms) . " rooms");
        if (count($rooms) === 0) {
            error_log("getRooms: No rooms found in database - check if rooms table exists and has data");
            error_log("getRooms: Checking if rooms table exists");
            $tableCheck = $pdo->query("SHOW TABLES LIKE 'rooms'");
            $tableExists = $tableCheck->fetchAll(PDO::FETCH_ASSOC);
            error_log("getRooms: Rooms table exists: " . (count($tableExists) > 0 ? 'yes' : 'no'));
            if (count($tableExists) > 0) {
                error_log("getRooms: Checking table structure");
                $structure = $pdo->query("DESCRIBE rooms");
                $columns = $structure->fetchAll(PDO::FETCH_ASSOC);
                error_log("getRooms: Table columns: " . json_encode($columns));
            }
        } else {
            error_log("getRooms: Sample room data: " . json_encode($rooms[0]));
            error_log("getRooms: All room data: " . json_encode($rooms));
        }
        echo json_encode($rooms);
    } catch(PDOException $e) {
        error_log("getRooms error: " . $e->getMessage());
        error_log("getRooms error details: " . $e->getTraceAsString());
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function checkAvailability() {
    global $pdo;
    $room_id = $_POST['room_id'];
    $date = $_POST['date'];
    $start_time = $_POST['start_time'];
    $end_time = $_POST['end_time'];
    
    $sql = "SELECT * FROM bookings 
            WHERE room_id = ? AND booking_date = ? 
            AND status = 'confirmed'
            AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$room_id, $date, $start_time, $start_time, $end_time, $end_time]);
    $conflicts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['available' => count($conflicts) === 0]);
}

function makeBooking() {
    global $pdo;
    $room_id = $_POST['room_id'];
    $user_name = $_POST['user_name'];
    $user_email = $_POST['user_email'];
    $purpose = $_POST['purpose'];
    $booking_date = $_POST['booking_date'];
    $start_time = $_POST['start_time'];
    $end_time = $_POST['end_time'];
    
    // First check availability
    $check_sql = "SELECT * FROM bookings 
                  WHERE room_id = ? AND booking_date = ? 
                  AND status = 'confirmed'
                  AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))";
    
    $stmt = $pdo->prepare($check_sql);
    $stmt->execute([$room_id, $booking_date, $start_time, $start_time, $end_time, $end_time]);
    $conflicts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if(count($conflicts) > 0) {
        echo json_encode(['success' => false, 'message' => 'Room not available for the selected time slot']);
        return;
    }
    
    // Insert booking
    $sql = "INSERT INTO bookings (room_id, user_name, user_email, purpose, booking_date, start_time, end_time, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')";
    
    $stmt = $pdo->prepare($sql);
    $success = $stmt->execute([$room_id, $user_name, $user_email, $purpose, $booking_date, $start_time, $end_time]);
    
    if($success) {
        echo json_encode(['success' => true, 'booking_id' => $pdo->lastInsertId()]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to create booking']);
    }
}

function getBookings() {
    global $pdo;
    $email = $_GET['email'] ?? '';
    
    if(empty($email)) {
        echo json_encode([]);
        return;
    }
    
    $sql = "SELECT b.*, r.name as room_name, r.location 
            FROM bookings b 
            JOIN rooms r ON b.room_id = r.id 
            WHERE b.user_email = ? 
            ORDER BY b.booking_date DESC, b.start_time DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$email]);
    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode($bookings);
}

function cancelBooking() {
    global $pdo;
    $booking_id = $_POST['booking_id'];
    
    $sql = "UPDATE bookings SET status = 'cancelled' WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $success = $stmt->execute([$booking_id]);
    
    echo json_encode(['success' => $success]);
}
?>