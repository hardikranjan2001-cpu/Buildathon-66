# Smart Waste Segregation System - Flask Backend
# Copy and paste this code into your VS Code

from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
import cv2
import base64
import numpy as np
from io import BytesIO
from PIL import Image
import json
import sqlite3
import uuid
from datetime import datetime
import os
import qrcode
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database setup
DATABASE = 'waste_segregation.db'

def init_db():
    """Initialize the database with required tables"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            address TEXT,
            qr_code_path TEXT,
            points INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Results table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            detected_items TEXT,
            waste_category TEXT,
            confidence REAL,
            is_correct BOOLEAN,
            reward_fine INTEGER,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # AWS Settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS aws_settings (
            id INTEGER PRIMARY KEY,
            access_key TEXT,
            secret_key TEXT,
            region TEXT DEFAULT 'us-east-1'
        )
    ''')
    
    conn.commit()
    conn.close()

# AWS Rekognition client
rekognition_client = None

def get_aws_settings():
    """Get AWS settings from database"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT access_key, secret_key, region FROM aws_settings WHERE id = 1')
    result = cursor.fetchone()
    conn.close()
    return result

def initialize_rekognition():
    """Initialize AWS Rekognition client"""
    global rekognition_client
    settings = get_aws_settings()
    if settings:
        access_key, secret_key, region = settings
        try:
            rekognition_client = boto3.client(
                'rekognition',
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region
            )
            return True
        except Exception as e:
            logger.error(f"Error initializing Rekognition: {e}")
            return False
    return False

@app.route('/')
def index():
    """Serve the main application"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    return send_from_directory('.', filename)

@app.route('/api/save-aws-settings', methods=['POST'])
def save_aws_settings():
    """Save AWS credentials"""
    try:
        data = request.json
        access_key = data.get('access_key')
        secret_key = data.get('secret_key')
        region = data.get('region', 'us-east-1')
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Insert or update AWS settings
        cursor.execute('''
            INSERT OR REPLACE INTO aws_settings (id, access_key, secret_key, region)
            VALUES (1, ?, ?, ?)
        ''', (access_key, secret_key, region))
        
        conn.commit()
        conn.close()
        
        # Reinitialize Rekognition client
        success = initialize_rekognition()
        
        return jsonify({
            'status': 'success' if success else 'error',
            'message': 'AWS settings saved successfully' if success else 'Failed to connect to AWS'
        })
        
    except Exception as e:
        logger.error(f"Error saving AWS settings: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/test-aws-connection', methods=['POST'])
def test_aws_connection():
    """Test AWS Rekognition connection"""
    try:
        if not rekognition_client:
            initialize_rekognition()
        
        if not rekognition_client:
            return jsonify({'status': 'error', 'message': 'AWS client not initialized'})
        
        # Test with a simple API call
        response = rekognition_client.list_collections()
        return jsonify({'status': 'success', 'message': 'AWS connection successful'})
        
    except ClientError as e:
        return jsonify({'status': 'error', 'message': f'AWS Error: {e.response["Error"]["Message"]}'})
    except NoCredentialsError:
        return jsonify({'status': 'error', 'message': 'AWS credentials not found'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/generate-user', methods=['POST'])
def generate_user():
    """Generate a new user with QR code"""
    try:
        data = request.json
        user_id = f"USR{str(uuid.uuid4())[:8].upper()}"
        
        # Create QR code
        qr_data = {
            'user_id': user_id,
            'name': data['name'],
            'type': 'waste_segregation_user'
        }
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(json.dumps(qr_data))
        qr.make(fit=True)
        
        # Save QR code image
        os.makedirs('static/qr_codes', exist_ok=True)
        qr_code_path = f'static/qr_codes/{user_id}.png'
        qr_img = qr.make_image(fill_color="black", back_color="white")
        qr_img.save(qr_code_path)
        
        # Save user to database
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO users (id, name, phone, email, address, qr_code_path)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, data['name'], data['phone'], data['email'], data['address'], qr_code_path))
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'user_id': user_id,
            'qr_code_url': f'/static/qr_codes/{user_id}.png',
            'user_data': {
                'id': user_id,
                'name': data['name'],
                'phone': data['phone'],
                'email': data['email'],
                'address': data['address']
            }
        })
        
    except Exception as e:
        logger.error(f"Error generating user: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/get-user/<user_id>')
def get_user(user_id):
    """Get user information"""
    try:
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
        conn.close()
        
        if user:
            return jsonify({
                'status': 'success',
                'user': {
                    'id': user[0],
                    'name': user[1],
                    'phone': user[2],
                    'email': user[3],
                    'address': user[4],
                    'points': user[6]
                }
            })
        else:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404
            
    except Exception as e:
        logger.error(f"Error getting user: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/process-frames', methods=['POST'])
def process_frames():
    """Process frames using AWS Rekognition"""
    try:
        data = request.json
        frames = data.get('frames', [])
        user_id = data.get('user_id')
        
        if not rekognition_client:
            return jsonify({'status': 'error', 'message': 'AWS Rekognition not initialized'})
        
        all_detections = []
        
        for frame_data in frames:
            # Decode base64 image
            image_data = base64.b64decode(frame_data.split(',')[1])
            
            try:
                # Call AWS Rekognition
                response = rekognition_client.detect_labels(
                    Image={'Bytes': image_data},
                    MaxLabels=10,
                    MinConfidence=70
                )
                
                # Process labels and classify waste
                for label in response['Labels']:
                    waste_category = classify_waste_item(label['Name'])
                    if waste_category:
                        all_detections.append({
                            'item': label['Name'],
                            'category': waste_category,
                            'confidence': label['Confidence'] / 100.0
                        })
                        
            except Exception as e:
                logger.error(f"Error processing frame with Rekognition: {e}")
                continue
        
        # Remove duplicates and get best detections
        unique_detections = {}
        for detection in all_detections:
            item = detection['item']
            if item not in unique_detections or detection['confidence'] > unique_detections[item]['confidence']:
                unique_detections[item] = detection
        
        final_detections = list(unique_detections.values())[:5]  # Top 5 detections
        
        # Calculate rewards/fines (simplified logic)
        total_reward = 0
        for detection in final_detections:
            # Assume correct segregation for demo (in real app, you'd compare with actual bin type)
            is_correct = True  # This should be determined by comparing with bin type
            reward = 10 if is_correct else -5
            total_reward += reward
            
            # Save result to database
            conn = sqlite3.connect(DATABASE)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO results (user_id, detected_items, waste_category, confidence, is_correct, reward_fine)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, detection['item'], detection['category'], detection['confidence'], is_correct, reward))
            conn.commit()
            conn.close()
        
        # Update user points
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET points = points + ? WHERE id = ?', (total_reward, user_id))
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'detections': final_detections,
            'total_reward': total_reward,
            'message': f'Processing complete. {len(final_detections)} items detected.'
        })
        
    except Exception as e:
        logger.error(f"Error processing frames: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

WASTE_CLASSIFICATION_RULES = {
    'Domestic Hazardous Waste': [
        'battery', 'electronic', 'e-waste', 'phone', 'computer',
        'medicine', 'pill', 'tablet', 'syringe', 'needle',
        'chemical', 'paint', 'pesticide', 'cleaner',
        'bulb', 'cfl', 'led', 'fluorescent', 'thermometer'
    ],
    'Wet Waste': [
        'food', 'fruit', 'vegetable', 'peel', 'rind', 'scraps',
        'leftovers', 'organic', 'banana', 'apple', 'orange',
        'bread', 'meat', 'fish', 'rice', 'egg shell', 'compost'
    ],
    'Dry Waste': [
        'paper', 'cardboard', 'carton', 'newspaper', 'magazine',
        'plastic', 'bottle', 'wrapper', 'bag',
        'can', 'tin', 'aluminum', 'metal', 'foil',
        'glass', 'jar', 'styrofoam'
    ]
}

def classify_waste_item(item_name):
    """Classify detected item into waste categories using a rule-based approach."""
    item_name = item_name.lower()

    # Check categories in order of priority (Hazardous > Wet > Dry)
    for category, keywords in WASTE_CLASSIFICATION_RULES.items():
        for keyword in keywords:
            if keyword in item_name:
                return category

    # Return None or a default category if no match is found
    return None # or 'Unclassified'

@app.route('/api/get-results')
def get_results():
    """Get all results"""
    try:
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT r.*, u.name 
            FROM results r 
            JOIN users u ON r.user_id = u.id 
            ORDER BY r.timestamp DESC
        ''')
        results = cursor.fetchall()
        conn.close()
        
        formatted_results = []
        for result in results:
            formatted_results.append({
                'id': result[0],
                'user_name': result[8],
                'detected_items': result[2],
                'waste_category': result[3],
                'confidence': result[4],
                'is_correct': result[5],
                'reward_fine': result[6],
                'timestamp': result[7]
            })
        
        return jsonify({'status': 'success', 'results': formatted_results})
        
    except Exception as e:
        logger.error(f"Error getting results: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/get-statistics')
def get_statistics():
    """Get system statistics"""
    try:
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Total users
        cursor.execute('SELECT COUNT(*) FROM users')
        total_users = cursor.fetchone()[0]
        
        # Total results
        cursor.execute('SELECT COUNT(*) FROM results')
        total_results = cursor.fetchone()[0]
        
        # Correct segregations
        cursor.execute('SELECT COUNT(*) FROM results WHERE is_correct = 1')
        correct_segregations = cursor.fetchone()[0]
        
        # Total rewards given
        cursor.execute('SELECT SUM(reward_fine) FROM results WHERE reward_fine > 0')
        total_rewards = cursor.fetchone()[0] or 0
        
        # Total fines collected
        cursor.execute('SELECT SUM(ABS(reward_fine)) FROM results WHERE reward_fine < 0')
        total_fines = cursor.fetchone()[0] or 0
        
        conn.close()
        
        return jsonify({
            'status': 'success',
            'statistics': {
                'total_users': total_users,
                'total_results': total_results,
                'correct_segregations': correct_segregations,
                'total_rewards': total_rewards,
                'total_fines': total_fines
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    # Initialize database
    init_db()
    
    # Create necessary directories
    os.makedirs('static/qr_codes', exist_ok=True)
    
    print("Smart Waste Segregation System Starting...")
    print("Make sure to:")
    print("1. Install required packages: pip install flask flask-cors boto3 opencv-python pillow qrcode")
    print("2. Place the HTML, CSS, and JS files in the same directory")
    print("3. Configure your AWS credentials in the Settings page")
    print("4. Access the application at http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000)