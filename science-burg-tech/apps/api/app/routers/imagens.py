"""Serve as fotos de produto guardadas no banco.

A rota é pública de propósito: a foto aparece no cardápio, que qualquer
visitante vê. O que protege o acervo é o id ser um token aleatório — sem
ele não dá para adivinhar o endereço de uma imagem.

O upload fica no router de administração (POST /api/admin/upload-imagem),
que exige papel de admin. Aqui só se lê.
"""

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.db import get_db

router = APIRouter(prefix="/imagens", tags=["imagens"])


@router.get("/{imagem_id}")
def obter_imagem(imagem_id: str, db: psycopg.Connection = Depends(get_db)) -> Response:
    linha = db.execute("SELECT mime, conteudo FROM imagens WHERE id = %s", (imagem_id,)).fetchone()
    if linha is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagem não encontrada")

    return Response(
        content=bytes(linha["conteudo"]),
        media_type=linha["mime"],
        # O conteúdo de um id nunca muda: cada upload gera um token novo, e
        # trocar a foto de um produto grava outra linha em vez de reescrever
        # esta. Por isso o cache pode ser longo e imutável — sem isso, toda
        # visita ao cardápio buscaria as fotos de novo pela API.
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
