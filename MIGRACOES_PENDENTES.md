# Migrações de banco pendentes

---

## [ ] Posições de capa/contracapa/sobrecapa sem limite nas edições ABERTAS

As edições novas já nascem com todas as posições ilimitadas (a "esgotada"
agora é manual, pelo botão Esgotar). Para as edições **abertas** que já
existem, libere o limite das posições que vinham com capacidade 1:

```sql
update public.edition_ad_positions p
set capacity = null,
    updated_at = now()
from public.newspaper_editions e
where p.edition_id = e.id
  and e.status = 'open'
  and p.position_code in ('cover', 'back_cover', 'overcover')
  and p.capacity is not null;
```

Sem isso, essas posições nas edições abertas continuam com limite 1 e
aparecem como "Esgotada" automaticamente após a 1ª venda.
