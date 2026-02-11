# send-whatsapp Edge Function

## Security Implementation

This edge function implements **JWT authentication and authorization** to protect against unauthorized access.

### Authentication Flow

1. **JWT Verification**: The function extracts and verifies the JWT token from the `Authorization` header
2. **User Authentication**: Uses Supabase's `auth.getUser()` to validate the token and retrieve user information
3. **Job Authorization**: Verifies that the authenticated user owns the job they're trying to send messages for

### Security Measures

- ✅ **Requires Authorization Header**: All requests must include a valid JWT token
- ✅ **User Verification**: Token is validated against Supabase Auth
- ✅ **Resource-Level Authorization**: Users can only send messages for jobs they own
- ✅ **401 Unauthorized**: Returns proper error for missing or invalid tokens
- ✅ **403 Forbidden**: Returns proper error when user doesn't own the job

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 401 | Missing authorization header | No token provided in request |
| 401 | Unauthorized: Invalid or expired token | Token verification failed |
| 403 | Forbidden: You do not have permission to access this job | User doesn't own the job |
| 404 | Job not found | Job ID doesn't exist |

### Environment Variables

Required environment variables:
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database operations
- `SUPABASE_ANON_KEY`: Anonymous key for user authentication

### Usage

The frontend automatically includes the user's JWT token when calling this function via `supabase.functions.invoke()`. No additional configuration is needed on the client side.

```typescript
// Frontend usage (authentication handled automatically)
const { data, error } = await supabase.functions.invoke('send-whatsapp', {
  body: {
    jobId: 'uuid-here',
    rows: [...],
  },
});
```

### Testing

To test the authentication:

1. **Without token**: Should return 401 Unauthorized
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/send-whatsapp \
     -H "Content-Type: application/json" \
     -d '{"jobId":"test","rows":[]}'
   ```

2. **With valid token**: Should succeed if user owns the job
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/send-whatsapp \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"jobId":"your-job-id","rows":[...]}'
   ```

3. **With someone else's job**: Should return 403 Forbidden

