# Alcapush 🚀

> AI-powered git commit message generator with GPT-5-nano support

Alcapush is an intelligent CLI tool that automatically generates meaningful, well-formatted commit messages using AI. It's similar to opencommit but with enhanced features, better UX, and support for the latest AI models including GPT-5-nano.

[![npm version](https://img.shields.io/npm/v/alcapush.svg)](https://www.npmjs.com/package/alcapush)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🤖 **Multiple AI Providers**: OpenAI (GPT-5-nano, GPT-4, GPT-3.5), Anthropic Claude, Google Gemini, Ollama
- 🎯 **Smart Fallback**: Automatically falls back to gpt-4o-mini if GPT-5-nano is not available
- 📝 **Conventional Commits**: Follows the Conventional Commits specification
- 🎨 **GitMoji Support**: Optional emoji prefixes for visual commit history
- 🌍 **Multi-language**: Generate commits in any language
- 💡 **Context-Aware**: Add custom context to improve commit messages
- ⚡ **Fast & Efficient**: Intelligent diff splitting for large changes
- 🎨 **Beautiful CLI**: Colorful output with progress indicators
- 🔧 **Highly Configurable**: Customize everything to match your workflow

## 📦 Installation

```bash
npm install -g alcapush
```

## 🚀 Quick Start

1. **Configure your API key**:

```bash
acp config set ACP_API_KEY=sk-your-openai-api-key
```

2. **Make some changes** to your code

3. **Generate and commit**:

```bash
smc
```

That's it! Alcapush will:
- Analyze your changes
- Generate a meaningful commit message
- Ask for confirmation
- Commit your changes

## 🎯 Usage

### Basic Usage

```bash
# Generate commit for staged changes
smc

# Auto-commit without confirmation
acp --yes

# Add additional context
acp -c "Fixing bug reported in issue #123"

# Use full GitMoji specification
acp --fgm
```

### Configuration

```bash
# Set configuration
acp config set KEY=VALUE

# Get configuration value
acp config get KEY

# List all configuration
acp config list

# Describe configuration options
acp config describe
acp config describe ACP_MODEL
```

## ⚙️ Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `ACP_API_KEY` | API key for the AI provider | - |
| `ACP_AI_PROVIDER` | AI provider (openai, anthropic, gemini, ollama) | `openai` |
| `ACP_MODEL` | Model name | `gpt-5-nano` (fallback: `gpt-4o-mini`) |
| `ACP_TOKENS_MAX_INPUT` | Max input tokens | `4096` |
| `ACP_TOKENS_MAX_OUTPUT` | Max output tokens | `500` |
| `ACP_EMOJI` | Enable GitMoji emojis | `false` |
| `ACP_LANGUAGE` | Language for commit messages | `en` |
| `ACP_DESCRIPTION` | Add detailed description | `false` |
| `ACP_ONE_LINE_COMMIT` | Generate one-line commits | `false` |
| `ACP_API_URL` | Custom API URL | - |

## 🤖 AI Provider Setup

### OpenAI (Default)

```bash
acp config set ACP_AI_PROVIDER=openai
acp config set ACP_API_KEY=sk-...
acp config set ACP_MODEL=gpt-5-nano  # or gpt-4o, gpt-4o-mini
```

### Anthropic Claude

```bash
acp config set ACP_AI_PROVIDER=anthropic
acp config set ACP_API_KEY=sk-ant-...
acp config set ACP_MODEL=claude-3-5-sonnet-20241022
```

### Google Gemini

```bash
acp config set ACP_AI_PROVIDER=gemini
acp config set ACP_API_KEY=your-gemini-key
acp config set ACP_MODEL=gemini-pro
```

### Ollama (Local)

```bash
# Start Ollama first
ollama run mistral

# Configure Alcapush
acp config set ACP_AI_PROVIDER=ollama
acp config set ACP_MODEL=mistral
```

## 🎨 Examples

### Enable GitMoji

```bash
acp config set ACP_EMOJI=true
smc
# Output: ✨ feat: add user authentication
```

### Add Detailed Descriptions

```bash
acp config set ACP_DESCRIPTION=true
smc
# Output:
# feat: add user authentication
#
# Implemented JWT-based authentication system with login and
# registration endpoints. Added middleware for protected routes.
```

### Multi-language Support

```bash
acp config set ACP_LANGUAGE=es
smc
# Output: feat: agregar autenticación de usuario
```

### One-line Commits

```bash
acp config set ACP_ONE_LINE_COMMIT=true
smc
# Output: feat: add user authentication
```

## 🆚 Comparison with OpenCommit

| Feature | Alcapush | OpenCommit |
|---------|-------------|------------|
| GPT-5-nano Support | ✅ | ❌ |
| Auto-fallback | ✅ | ❌ |
| Colorful CLI | ✅ | ✅ |
| Progress Indicators | ✅ | ❌ |
| Multiple AI Providers | ✅ | ✅ |
| GitMoji Support | ✅ | ✅ |
| Config Management | ✅ | ✅ |
| Context Flag | ✅ | ✅ |

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/yourusername/Alcapush.git
cd Alcapush

# Install dependencies
npm install

# Build
npm run build

# Link locally
npm link

# Test
smc
```

## 📝 License

MIT © [Your Name]

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

Inspired by [opencommit](https://github.com/di-sukharev/opencommit) by di-sukharev.

## 📧 Support

If you have any questions or issues, please open an issue on GitHub.

---

Made with ❤️ and AI
