import sys
import json
import os

class XYZProcessor:
    def __init__(self):
        self.files = {}
        self.box = [150.0, 100.0, 100.0]
        self.settings_file = 'settings.json'
        self.load_settings()

    def load_settings(self):
        if os.path.exists(self.settings_file):
            try:
                with open(self.settings_file, 'r') as f:
                    data = json.load(f)
                    self.box = data.get('box', [150.0, 100.0, 100.0])
                    self.files = data.get('files', {})
            except:
                pass

    def save_settings(self):
        with open(self.settings_file, 'w') as f:
            json.dump({'box': self.box, 'files': self.files}, f)

    def upload_file(self, filename, content):
        lines = content.strip().split('\n')
        if not lines:
            return False
        
        try:
            # XYZ format: first line is atom count
            atom_count = int(lines[0].strip())
            
            # Store the content in a local file for processing
            with open(filename, 'w') as f:
                f.write(content)
            
            if filename not in self.files:
                self.files[filename] = {
                    'filename': filename,
                    'atomCount': atom_count,
                    'offset': [0.0, 0.0, 0.0],
                    'order': len(self.files) + 1
                }
            else:
                # Update atom count if file replaced
                self.files[filename]['atomCount'] = atom_count
                
            self.save_settings()
            return True
        except Exception as e:
            print(f"Error uploading {filename}: {e}", file=sys.stderr)
            return False

    def update_offset(self, filename, dx, dy, dz):
        if filename in self.files:
            self.files[filename]['offset'] = [float(dx), float(dy), float(dz)]
            self.save_settings()
            return True
        return False

    def update_order(self, filename, order):
        if filename in self.files:
            self.files[filename]['order'] = int(order)
            self.save_settings()
            return True
        return False

    def update_box(self, x, y, z):
        self.box = [float(x), float(y), float(z)]
        self.save_settings()
        return True

    def get_files(self):
        # Return sorted by order
        return sorted(self.files.values(), key=lambda x: x['order'])

    def delete_file(self, filename):
        if filename in self.files:
            if os.path.exists(filename):
                os.remove(filename)
            del self.files[filename]
            # Re-order remaining files
            sorted_files = sorted(self.files.values(), key=lambda x: x['order'])
            for i, f in enumerate(sorted_files):
                f['order'] = i + 1
            self.save_settings()
            return True
        return False

    def reset(self):
        for filename in self.files:
            if os.path.exists(filename):
                os.remove(filename)
        self.files = {}
        self.box = [150.0, 100.0, 100.0]
        if os.path.exists(self.settings_file):
            os.remove(self.settings_file)
        return True

    def generate_config(self, title):
        total_atoms = sum(f['atomCount'] for f in self.files.values())
        
        output = [title]
        # Line 2: levcfg (0), imcon (6), natms (total_atoms)
        output.append(f"          0          6 {total_atoms:>10}")
        
        # Box vectors
        output.append(f" {self.box[0]:20.10f}  0.00000000  0.00000000")
        output.append(f"  0.00000000 {self.box[1]:20.10f}  0.00000000")
        output.append(f"  0.00000000  0.00000000 {self.box[2]:20.10f}")

        sorted_files = sorted(self.files.values(), key=lambda x: x['order'])
        
        global_atom_index = 1
        for file_info in sorted_files:
            filename = file_info['filename']
            offset = file_info['offset']
            if os.path.exists(filename):
                with open(filename, 'r') as f:
                    lines = f.readlines()
                    if len(lines) < 2: continue
                    
                    atom_count = int(lines[0].strip())
                    # Skip header and comment line
                    for i in range(2, 2 + atom_count):
                        if i >= len(lines): break
                        parts = lines[i].split()
                        if len(parts) >= 4:
                            element = parts[0]
                            x = float(parts[1]) + offset[0]
                            y = float(parts[2]) + offset[1]
                            z = float(parts[3]) + offset[2]
                            
                            # DL_POLY CONFIG format:
                            # Element   Index
                            # X   Y   Z
                            output.append(f"{element:<8} {global_atom_index:>10}")
                            output.append(f"{x:20.10f}{y:20.10f}{z:20.10f}")
                            global_atom_index += 1

        return "\n".join(output)

if __name__ == "__main__":
    processor = XYZProcessor()
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "get_data":
            print(json.dumps({'files': processor.get_files(), 'box': processor.box}))
        elif cmd == "upload":
            filename = sys.argv[2]
            content = sys.stdin.read()
            success = processor.upload_file(filename, content)
            print(json.dumps({'success': success}))
        elif cmd == "shift":
            filename = sys.argv[2]
            dx, dy, dz = sys.argv[3:6]
            print(json.dumps({'success': processor.update_offset(filename, dx, dy, dz)}))
        elif cmd == "order":
            filename = sys.argv[2]
            order = sys.argv[3]
            print(json.dumps({'success': processor.update_order(filename, order)}))
        elif cmd == "box":
            x, y, z = sys.argv[2:5]
            print(json.dumps({'success': processor.update_box(x, y, z)}))
        elif cmd == "reset":
            print(json.dumps({'success': processor.reset()}))
        elif cmd == "delete":
            filename = sys.argv[2]
            # Use stderr for logging to avoid polluting stdout (which is JSON)
            print(f"Engine: Deleting {filename}", file=sys.stderr)
            print(json.dumps({'success': processor.delete_file(filename)}))
        elif cmd == "config":
            title = sys.argv[2] if len(sys.argv) > 2 else "Generated by XYZ Collator"
            print(processor.generate_config(title))
