<?php
session_start();
if (isset($_SESSION["genere"])) {
    // Simulazione: ritorna un genere casuale diverso da quello selezionato
    $genere_utente = $_SESSION["genere"];
    $generi = ["maschio", "femmina", "altro"];
    $altri_generi = array_filter($generi, function($g) use ($genere_utente) {
        return $g !== $genere_utente;
    });
    $genere_altro = array_values($altri_generi)[array_rand($altri_generi)];
    echo json_encode(["altroGenere" => ucfirst($genere_altro)]);
} else {
    echo json_encode(["altroGenere" => "Sconosciuto"]);
}
?>
