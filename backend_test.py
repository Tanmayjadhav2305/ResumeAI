import requests
import sys
import time
from datetime import datetime

class ResumeAnalyzerAPITester:
    def __init__(self, base_url="https://resumegenius-62.preview.emergentagent.com"):
        self.base_url = base_url
        self.user_id = None
        self.user_email = None
        self.usage_count = 0
        self.tests_run = 0
        self.tests_passed = 0
        self.analysis_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Remove Content-Type for file uploads
        if files:
            headers = {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, data=data, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {response_data}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_magic_link_request(self):
        """Test magic link request"""
        test_email = f"test{int(time.time())}@resumeai.com"
        self.user_email = test_email
        
        success, response = self.run_test(
            "Magic Link Request",
            "POST",
            "api/auth/magic-link",
            200,
            data={"email": test_email}
        )
        
        if success and 'token' in response:
            self.magic_token = response['token']
            print(f"   Token received: {self.magic_token[:20]}...")
            return True
        return False

    def test_magic_link_verify(self):
        """Test magic link verification"""
        if not hasattr(self, 'magic_token'):
            print("❌ No magic token available for verification")
            return False
            
        success, response = self.run_test(
            "Magic Link Verify",
            "POST",
            "api/auth/verify",
            200,
            data={"token": self.magic_token}
        )
        
        if success and 'user_id' in response:
            self.user_id = response['user_id']
            self.usage_count = response.get('usage_count', 0)
            print(f"   User ID: {self.user_id}")
            print(f"   Usage Count: {self.usage_count}")
            return True
        return False

    def test_get_user_info(self):
        """Test getting user information"""
        if not self.user_id:
            print("❌ No user ID available")
            return False
            
        success, response = self.run_test(
            "Get User Info",
            "GET",
            f"api/user/{self.user_id}",
            200
        )
        
        if success:
            print(f"   Email: {response.get('email')}")
            print(f"   Usage: {response.get('usage_count')}/{response.get('usage_limit')}")
            return True
        return False

    def test_analyze_resume_text(self, resume_text, role_target=None):
        """Test resume text analysis"""
        if not self.user_id:
            print("❌ No user ID available")
            return False
            
        data = {"resume_text": resume_text}
        if role_target:
            data["role_target"] = role_target
            
        success, response = self.run_test(
            f"Analyze Resume Text ({'with role' if role_target else 'without role'})",
            "POST",
            f"api/analyze/text?user_id={self.user_id}",
            200,
            data=data
        )
        
        if success and 'analysis_id' in response:
            self.analysis_id = response['analysis_id']
            analysis = response.get('analysis', {})
            
            # Validate analysis structure
            required_fields = ['overall_score', 'score_verdict', 'summary_insight', 'strengths', 'weaknesses', 'ats_issues', 'improved_bullets', 'recommendations']
            missing_fields = [field for field in required_fields if field not in analysis]
            
            if missing_fields:
                print(f"⚠️  Missing analysis fields: {missing_fields}")
            else:
                print(f"   Analysis ID: {self.analysis_id}")
                print(f"   Overall Score: {analysis.get('overall_score')}")
                print(f"   Strengths: {len(analysis.get('strengths', []))}")
                print(f"   Weaknesses: {len(analysis.get('weaknesses', []))}")
                print(f"   Remaining Uses: {response.get('remaining_uses')}")
            
            return True
        return False

    def test_get_analyses_history(self):
        """Test getting user's analysis history"""
        if not self.user_id:
            print("❌ No user ID available")
            return False
            
        success, response = self.run_test(
            "Get Analyses History",
            "GET",
            f"api/analyses/{self.user_id}",
            200
        )
        
        if success:
            analyses = response.get('analyses', [])
            print(f"   Found {len(analyses)} analyses")
            if analyses:
                latest = analyses[0]
                print(f"   Latest analysis: {latest.get('id', 'N/A')}")
            return True
        return False

    def test_usage_limit_enforcement(self):
        """Test that usage limit is enforced after 3 analyses"""
        if not self.user_id:
            print("❌ No user ID available")
            return False
            
        # Try to analyze when limit should be reached
        sample_resume = "Test resume for limit check\nSoftware Engineer\nPython, JavaScript"
        
        success, response = self.run_test(
            "Usage Limit Enforcement",
            "POST",
            f"api/analyze/text?user_id={self.user_id}",
            403,  # Should be forbidden
            data={"resume_text": sample_resume}
        )
        
        return success  # Success means we got the expected 403 error

def main():
    print("🚀 Starting AI Resume Analyzer Backend API Tests")
    print("=" * 60)
    
    tester = ResumeAnalyzerAPITester()
    
    # Sample resume text for testing
    sample_resume = """John Doe
Software Engineer
john@email.com
(555) 123-4567

EXPERIENCE
Senior Software Developer - Tech Corp (2020-2024)
- Worked on various projects using Python and JavaScript
- Helped team members with code reviews
- Fixed bugs and implemented new features
- Collaborated with cross-functional teams

Junior Developer - StartupXYZ (2018-2020)
- Developed web applications
- Maintained existing codebase
- Participated in agile development process

SKILLS
Programming: Python, JavaScript, React, Node.js
Databases: PostgreSQL, MongoDB
Tools: Git, Docker, AWS

EDUCATION
Bachelor of Computer Science
University of Technology (2014-2018)
"""

    # Test sequence
    test_results = []
    
    # 1. Test authentication flow
    print("\n📧 Testing Authentication Flow")
    test_results.append(("Magic Link Request", tester.test_magic_link_request()))
    test_results.append(("Magic Link Verify", tester.test_magic_link_verify()))
    test_results.append(("Get User Info", tester.test_get_user_info()))
    
    # 2. Test resume analysis (first analysis)
    print("\n🔍 Testing Resume Analysis")
    test_results.append(("Analyze Resume Text (1st)", tester.test_analyze_resume_text(sample_resume)))
    test_results.append(("Analyze Resume with Role", tester.test_analyze_resume_text(sample_resume, "Frontend Developer")))
    test_results.append(("Analyze Resume Text (3rd)", tester.test_analyze_resume_text(sample_resume)))
    
    # 3. Test history
    print("\n📊 Testing Analysis History")
    test_results.append(("Get Analyses History", tester.test_get_analyses_history()))
    
    # 4. Test usage limit
    print("\n🚫 Testing Usage Limit")
    test_results.append(("Usage Limit Enforcement", tester.test_usage_limit_enforcement()))
    
    # Print final results
    print("\n" + "=" * 60)
    print("📊 FINAL TEST RESULTS")
    print("=" * 60)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All backend API tests passed!")
        return 0
    else:
        print("⚠️  Some backend API tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())