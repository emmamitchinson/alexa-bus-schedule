# alexa-metrolink-schedule
An Amazon Echo Skill that uses the TfGM Metrolink API to fetch the next trams for a given stop.

## Requirements
Node 6 or above.

## Usage/Testing
`npm install`  
`alexa-skill-test`

## Intents

### GetNextMetrolinkFromAIntent
| Slot | Description | Example |
| -- | -- | -- |
| `metrostop` | departure tram stop | `piccadilly` |

### GetNextMetrolinkFromAtoBIntent
| Slot | Description | Example |
| -- | -- | -- |
| `metrostopA` | departure tram stop | `piccadilly` |
| `metrostopB` | destination tram stop | `chorlton` |
