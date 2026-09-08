# Security Checklist

- [ ] Autenticação implementada corretamente (hash de senhas, tokens seguros)
- [ ] Autorização/validação de permissões em todas as rotas sensíveis
- [ ] Variáveis de ambiente/segredos fora do controle de versão
- [ ] Validação e sanitização de todas as entradas do usuário
- [ ] Proteção contra SQL Injection (uso de ORM/queries parametrizadas)
- [ ] Proteção contra XSS e CSRF
- [ ] HTTPS habilitado em produção
- [ ] Dependências atualizadas e sem vulnerabilidades conhecidas
- [ ] Logs não expõem dados sensíveis
- [ ] Rate limiting em endpoints críticos (login, cadastro, etc.)
