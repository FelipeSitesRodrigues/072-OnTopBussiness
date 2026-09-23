@echo off
rem Abre o site da On Top Business no navegador (servidor local na porta 3072).
cd /d "%~dp0"
start "" http://localhost:3072
node scripts\serve.mjs 3072
