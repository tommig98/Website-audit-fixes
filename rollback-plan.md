# 🚨 Piano di Rollback di Emergenza

## Rollback Rapido (< 5 minuti)

### Scenario: Sito down o errori critici

```bash
# 1. ROLLBACK IMMEDIATO
git checkout main
git reset --hard backup/pre-audit-fixes
git push --force-with-lease origin main

# 2. RESTART SERVIZI
pm2 restart all

# 3. VERIFICHE POST-ROLLBACK
curl -f https://yoursite.com/health
```

## Strategie di Rollback per Scenario

### JavaScript Issues
```bash
# Disabilita JS migliorato
git checkout HEAD~1 -- website-improvements.js
git commit -m "hotfix: disable improved JS"
git push
```

### CSS/Layout Issues  
```bash
# Ripristina CSS precedente
cp backup/original-styles.css styles.css
git add styles.css && git commit -m "hotfix: revert CSS"
```

### Performance Issues
```bash
# Test performance
curl -w "time_total: %{time_total}s\n" -s -o /dev/null https://yoursite.com
# Se > 3s, rollback assets
git checkout HEAD~1 -- dist/
```

## Test Post-Rollback

1. **Homepage loading** < 3 secondi ✓
2. **Navigation** funzionante ✓  
3. **Forms** senza errori ✓
4. **Mobile** responsive ✓
5. **No JS errors** in console ✓

## Comunicazione

```bash
# Slack notification
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"🚨 ROLLBACK COMPLETATO"}' \
  $SLACK_WEBHOOK_URL
```

---
**🚨 EMERGENCY CONTACT**: +39 XXX XXXXXXX
