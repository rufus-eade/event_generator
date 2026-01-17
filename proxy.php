<?php
// proxy.php for calendar.ehgp.uk/event_generator/
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/calendar; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');

// Get the URL parameter
$url = $_GET['url'] ?? '';

if (empty($url)) {
    http_response_code(400);
    echo 'Missing URL parameter';
    exit;
}

// Validate URL
if (!filter_var($url, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    echo 'Invalid URL';
    exit;
}

// Only allow specific domains for security
$allowedDomains = [
    'teamup.com',
    'ics.teamup.com'
];

$urlParts = parse_url($url);
$isAllowed = false;
foreach ($allowedDomains as $domain) {
    if (strpos($urlParts['host'], $domain) !== false) {
        $isAllowed = true;
        break;
    }
}

if (!$isAllowed) {
    http_response_code(403);
    echo 'Domain not allowed';
    exit;
}

// Set timeout and user agent
$options = [
    'http' => [
        'method' => 'GET',
        'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n",
        'timeout' => 10
    ]
];

$context = stream_context_create($options);

// Fetch the content
$content = @file_get_contents($url, false, $context);

if ($content === false) {
    http_response_code(500);
    echo 'Failed to fetch URL';
    exit;
}

// Check if it's a valid ICS file
if (strpos($content, 'BEGIN:VCALENDAR') === false && strpos($content, 'BEGIN:VEVENT') === false) {
    http_response_code(400);
    echo 'Invalid ICS file';
    exit;
}

echo $content;
?>