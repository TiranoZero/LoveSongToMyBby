const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Configuração
const MUSIC_DIR = path.join(__dirname, 'aud');

// Estado Global
let clients = []; // Lista de ouvintes conectados
let currentSongIndex = 0;

// Função para pegar lista de músicas
function getPlaylist() {
    return fs.readdirSync(MUSIC_DIR).filter(file => file.endsWith('.mp3'));
}

// Lógica de Streaming (O Coração da Rádio)
function startRadio() {
    const playlist = getPlaylist();
    
    if (playlist.length === 0) {
        console.log("Nenhuma música encontrada na pasta 'audio'");
        return;
    }

    const songPath = path.join(MUSIC_DIR, playlist[currentSongIndex]);
    console.log(`Tocando agora: ${playlist[currentSongIndex]}`);

    // Cria o comando FFmpeg
    const stream = ffmpeg(songPath)
        .format('mp3')        // Força o formato MP3 no fluxo
        .audioBitrate('128k') // Normaliza a qualidade (importante para streaming estável)
        .on('end', () => {
            console.log('Música acabou. Próxima...');
            currentSongIndex = (currentSongIndex + 1) % playlist.length; // Loop infinito
            startRadio(); // Chama a função novamente (Recursão para o loop)
        })
        .on('error', (err) => {
            console.error('Erro no FFmpeg:', err);
            // Tenta pular para a próxima em caso de erro
            currentSongIndex = (currentSongIndex + 1) % playlist.length;
            startRadio();
        });

    // O "Pulo do Gato": Pipe (tubo) personalizado
    // O FFmpeg gera dados. Nós pegamos esses dados e jogamos para TODOS os clientes.
    const ffstream = stream.pipe();

    ffstream.on('data', (chunk) => {
        // Para cada pedaço de áudio processado...
        for (const res of clients) {
            // ...escrevemos na resposta de cada cliente conectado
            res.write(chunk);
        }
    });
}

// Endpoint para o ouvinte se conectar
app.get('/stream', (req, res) => {
    // 1. Cabeçalhos importantes para o navegador entender que é uma rádio
    res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked', // Permite envio contínuo sem fim definido
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    });

    // 2. Adiciona este cliente à lista de transmissão
    clients.push(res);
    console.log(`Novo ouvinte conectado. Total: ${clients.length}`);

    // 3. Gerenciar desconexão
    req.on('close', () => {
        // Remove o cliente da lista quando ele fecha a aba
        clients = clients.filter(client => client !== res);
        console.log(`Ouvinte desconectado. Total: ${clients.length}`);
    });
});

// Inicia o servidor e a rádio
app.listen(PORT, () => {
    console.log(`Rádio rodando em http://localhost:${PORT}/stream`);
    startRadio(); // Inicia o "DJ" assim que o servidor sobe
});