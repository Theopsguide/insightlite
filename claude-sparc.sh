#!/bin/bash

# SPARC Automated Development System
# Generic workflow for comprehensive software development using SPARC methodology

set -e  # Exit on any error

# Default configuration
PROJECT_NAME="sparc-project"
README_PATH="README.md"
MCP_CONFIG=".roo/mcp.json"
VERBOSE=false
DRY_RUN=false
SKIP_RESEARCH=false
SKIP_TESTS=false
TEST_COVERAGE_TARGET=100
PARALLEL_EXECUTION=true
COMMIT_FREQUENCY="phase"  # phase, feature, or manual
OUTPUT_FORMAT="text"
DEVELOPMENT_MODE="full"   # full, backend-only, frontend-only, api-only

# Help function
show_help() {
    cat << 'HELP_EOF'
SPARC Automated Development System
==================================
A comprehensive, automated software development workflow using SPARC methodology
(Specification, Pseudocode, Architecture, Refinement, Completion)

USAGE:
    ./claude-sparc.sh [OPTIONS] [PROJECT_NAME] [README_PATH]

ARGUMENTS:
    PROJECT_NAME    Name of the project to develop (default: sparc-project)
    README_PATH     Path to initial requirements/readme file (default: readme.md)

OPTIONS:
    -h, --help                  Show this help message
    -v, --verbose              Enable verbose output
    -d, --dry-run              Show what would be done without executing
    -c, --config FILE          MCP configuration file (default: .roo/mcp.json)
    
    # Research Options
    --skip-research            Skip the web research phase
    --research-depth LEVEL     Research depth: basic, standard, comprehensive (default: standard)
    
    # Development Options
    --mode MODE                Development mode: full, backend-only, frontend-only, api-only (default: full)
    --skip-tests               Skip test development (not recommended)
    --coverage TARGET          Test coverage target percentage (default: 100)
    --no-parallel              Disable parallel execution
    
    # Commit Options
    --commit-freq FREQ         Commit frequency: phase, feature, manual (default: phase)
    --no-commits               Disable automatic commits
    
    # Output Options
    --output FORMAT            Output format: text, json, markdown (default: text)
    --quiet                    Suppress non-essential output

EXAMPLES:
    # Basic usage
    ./claude-sparc.sh my-app docs/requirements.md
    
    # Backend API development with verbose output
    ./claude-sparc.sh --mode api-only --verbose user-service api-spec.md
    
    # Quick prototype without research
    ./claude-sparc.sh --skip-research --coverage 80 prototype-app readme.md
    
    # Dry run to see what would be executed
    ./claude-sparc.sh --dry-run --verbose my-project requirements.md

DEVELOPMENT MODES:
    full            Complete full-stack development (default)
    backend-only    Backend services and APIs only
    frontend-only   Frontend application only
    api-only        REST/GraphQL API development only

For more information, see the documentation.
HELP_EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -c|--config)
                MCP_CONFIG="$2"
                shift 2
                ;;
            --skip-research)
                SKIP_RESEARCH=true
                shift
                ;;
            --research-depth)
                RESEARCH_DEPTH="$2"
                shift 2
                ;;
            --mode)
                DEVELOPMENT_MODE="$2"
                shift 2
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --coverage)
                TEST_COVERAGE_TARGET="$2"
                shift 2
                ;;
            --no-parallel)
                PARALLEL_EXECUTION=false
                shift
                ;;
            --commit-freq)
                COMMIT_FREQUENCY="$2"
                shift 2
                ;;
            --no-commits)
                COMMIT_FREQUENCY="manual"
                shift
                ;;
            --output)
                OUTPUT_FORMAT="$2"
                shift 2
                ;;
            --quiet)
                VERBOSE=false
                shift
                ;;
            -*)
                echo "Unknown option: $1" >&2
                echo "Use --help for usage information" >&2
                exit 1
                ;;
            *)
                if [[ "$PROJECT_NAME" == "sparc-project" ]]; then
                    PROJECT_NAME="$1"
                elif [[ "$README_PATH" == "README.md" ]]; then
                    README_PATH="$1"
                else
                    echo "Too many arguments: $1" >&2
                    echo "Use --help for usage information" >&2
                    exit 1
                fi
                shift
                ;;
        esac
    done
}

# Execute SPARC development process
execute_sparc_development() {
    local allowed_tools="View,Edit,Replace,GlobTool,GrepTool,LS,Bash"
    
    if [[ "$SKIP_RESEARCH" != true ]]; then
        allowed_tools="$allowed_tools,WebFetchTool"
    fi
    
    if [[ "$PARALLEL_EXECUTION" == true ]]; then
        allowed_tools="$allowed_tools,BatchTool,dispatch_agent"
    fi

    local claude_flags="--mcp-config $MCP_CONFIG --dangerously-skip-permissions"
    
    if [[ "$VERBOSE" == true ]]; then
        claude_flags="$claude_flags --verbose"
    fi

    echo "Starting SPARC Development Process..."
    echo "Project: $PROJECT_NAME"
    echo "README: $README_PATH"
    echo "Mode: $DEVELOPMENT_MODE"
    echo "Coverage Target: $TEST_COVERAGE_TARGET%"
    echo ""
    
    if [[ "$DRY_RUN" == true ]]; then
        echo "DRY RUN - Would execute Claude with:"
        echo "  Tools: $allowed_tools"
        echo "  Flags: $claude_flags"
        echo "  Project: $PROJECT_NAME"
        echo "  README: $README_PATH"
        return 0
    fi

    # Execute Claude with SPARC methodology
    claude "
# SPARC Automated Development System
# Project: ${PROJECT_NAME}
# Configuration: Mode=${DEVELOPMENT_MODE}, Coverage=${TEST_COVERAGE_TARGET}%

## PHASE 1: SPECIFICATION
Analyze ${README_PATH} and create detailed specifications including:
- Functional requirements
- Non-functional requirements  
- Technical constraints
- User stories and acceptance criteria

## PHASE 2: PSEUDOCODE
Design high-level architecture:
- System components and data flow
- Core algorithms and business logic
- Test strategy with ${TEST_COVERAGE_TARGET}% coverage target

## PHASE 3: ARCHITECTURE
Create detailed system design:
- Component architecture and interfaces
- Data architecture and database design
- Infrastructure and deployment architecture

## PHASE 4: REFINEMENT (TDD Implementation)
Implement using Test-Driven Development:
- Write failing tests first (Red)
- Implement minimal code to pass (Green)
- Refactor for quality (Refactor)
- Maintain ${TEST_COVERAGE_TARGET}% test coverage

## PHASE 5: COMPLETION
Final integration and deployment:
- System integration testing
- Documentation completion
- Production deployment preparation
- Monitoring and observability setup

## SUCCESS CRITERIA:
- ✅ ${TEST_COVERAGE_TARGET}% test coverage achieved
- ✅ All quality gates passed
- ✅ Production deployment successful
- ✅ Comprehensive documentation complete

Display '<SPARC-COMPLETE>' when finished.
" \
    --allowedTools "$allowed_tools" \
    $claude_flags
}

# Main execution
main() {
    parse_args "$@"
    
    # Validate configuration
    case $DEVELOPMENT_MODE in
        full|backend-only|frontend-only|api-only) ;;
        *) echo "Error: Invalid development mode: $DEVELOPMENT_MODE" >&2; exit 1 ;;
    esac
    
    if [[ "$VERBOSE" == true ]]; then
        echo "SPARC Configuration:"
        echo "==================="
        echo "Project Name: $PROJECT_NAME"
        echo "README Path: $README_PATH"
        echo "Development Mode: $DEVELOPMENT_MODE"
        echo "Test Coverage Target: $TEST_COVERAGE_TARGET%"
        echo "Parallel Execution: $PARALLEL_EXECUTION"
        echo "==================="
    fi
    
    # Execute the SPARC development process
    execute_sparc_development
}

# Execute main function with all arguments
main "$@"
