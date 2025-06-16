<?php
session_start();
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $data = json_decode(file_get_contents("php://input"), true);
    $_SESSION["genere"] = $data["genere"];
    echo json_encode(["status" => "ok"]);
}
?>
